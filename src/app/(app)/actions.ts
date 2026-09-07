"use server";
import {and,desc,eq,sql} from "drizzle-orm";
import {randomUUID} from "node:crypto";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {z} from "zod";
import {getDb} from "@/db";
import {auditLogs,businessRecords,customers,financeTransactions,membershipRenewals,membershipSubscriptions,products,tasks,usdTransactions,websites} from "@/db/schema";
import {requireSession} from "@/lib/auth";
import {actionError,fail,ok,type ActionResult} from "@/lib/action-result";
import {syncBusinessFinance,syncCustomerLastBusiness} from "@/lib/business-ops";
import {optionalUuid,parseMoney,parseRequiredMoney,parseWhen,requiredUuid,text} from "@/lib/form-parse";
import {syncMembershipReminderTasks} from "@/lib/membership";
import {averageCost,consume,profit,recharge} from "@/lib/finance";

async function audit(action:string,entityType:string,entityId:string){
  const s=await requireSession();
  await getDb().insert(auditLogs).values({workspaceId:s.workspaceId,userId:s.userId,action,entityType,entityId});
}

function finish(paths:string|string[],result:ActionResult){
  for(const path of Array.isArray(paths)?paths:[paths])revalidatePath(path);
  const target=Array.isArray(paths)?paths[0]:paths;
  if(!result.ok)redirect(`${target}?error=${encodeURIComponent(result.error)}`);
  if(result.message)redirect(`${target}?success=${encodeURIComponent(result.message)}`);
  redirect(target);
}

async function assertCustomer(workspaceId:string,customerId:string|null){
  if(!customerId)return null;
  const [row]=await getDb().select({id:customers.id}).from(customers).where(and(eq(customers.id,customerId),eq(customers.workspaceId,workspaceId))).limit(1);
  if(!row)throw new Error("客户不存在或不属于当前工作空间");
  return customerId;
}

async function assertProduct(workspaceId:string,productId:string|null){
  if(!productId)return null;
  const [row]=await getDb().select({id:products.id}).from(products).where(and(eq(products.id,productId),eq(products.workspaceId,workspaceId))).limit(1);
  if(!row)throw new Error("商品不存在或不属于当前工作空间");
  return productId;
}

export async function createCustomer(data:FormData){
  let result:ActionResult;
  try{
    const s=await requireSession();
    const p=z.object({name:text(1,120),phone:z.string().trim().max(32),wechat:z.string().trim().max(80),notes:z.string().trim().max(1000)}).parse(Object.fromEntries(data));
    const [row]=await getDb().insert(customers).values({workspaceId:s.workspaceId,...p}).returning({id:customers.id});
    await audit("create","customer",row.id);
    result=ok("客户已保存");
  }catch(e){result=fail(actionError(e))}
  finish("/customers",result);
}

export async function updateCustomer(data:FormData){
  let result:ActionResult;
  const rawId=String(data.get("id")??"");
  try{
    const s=await requireSession();
    const id=requiredUuid(data.get("id"),"客户");
    const p=z.object({name:text(1,120),phone:z.string().trim().max(32),wechat:z.string().trim().max(80),notes:z.string().trim().max(1000)}).parse(Object.fromEntries(data));
    const updated=await getDb().update(customers).set({...p,updatedAt:new Date()}).where(and(eq(customers.id,id),eq(customers.workspaceId,s.workspaceId))).returning({id:customers.id});
    if(!updated[0])throw new Error("客户不存在或无权修改");
    await audit("update","customer",id);
    result=ok("客户已更新");
  }catch(e){result=fail(actionError(e))}
  finish(rawId?[`/customers/${rawId}`,"/customers"]:"/customers",result);
}

export async function deleteCustomer(data:FormData){
  let result:ActionResult;
  try{
    const s=await requireSession();
    const id=requiredUuid(data.get("id"),"客户");
    const linked=await getDb().select({id:businessRecords.id}).from(businessRecords).where(and(eq(businessRecords.workspaceId,s.workspaceId),eq(businessRecords.customerId,id))).limit(1);
    if(linked[0])throw new Error("该客户仍有关联业务，无法删除");
    const removed=await getDb().delete(customers).where(and(eq(customers.id,id),eq(customers.workspaceId,s.workspaceId))).returning({id:customers.id});
    if(!removed[0])throw new Error("客户不存在或无权删除");
    await audit("delete","customer",id);
    result=ok("客户已删除");
  }catch(e){result=fail(actionError(e))}
  finish("/customers",result);
}

export async function createBusiness(data:FormData){
  let result:ActionResult;
  let createdId="";
  try{
    const s=await requireSession();
    const p=z.object({customerId:z.string().optional().or(z.literal("")),productId:z.string().optional().or(z.literal("")),type:z.enum(["membership","account","physical","service","other"]),content:text(1,500),status:z.enum(["pending_payment","paid_pending","processing","completed","after_sale","refunded"]),occurredAt:z.string().optional()}).parse(Object.fromEntries(data));
    const revenue=parseRequiredMoney(data.get("revenue"),"收款");
    const cost=parseMoney(data.get("cost"),"成本");
    const direct=parseRequiredMoney(data.get("directExpense")??"0","直接支出");
    const customerId=await assertCustomer(s.workspaceId,optionalUuid(p.customerId??null));
    const productId=await assertProduct(s.workspaceId,optionalUuid(p.productId??null));
    const occurredAt=parseWhen(p.occurredAt??null);
    const number=`YW${new Date().toISOString().replace(/\D/g,"").slice(0,17)}${randomUUID().slice(0,4)}`;
    const db=getDb();
    const [row]=await db.transaction(async tx=>{
      const inserted=await tx.insert(businessRecords).values({number,workspaceId:s.workspaceId,customerId,productId,type:p.type,content:p.content,status:p.status,occurredAt,revenueCents:revenue,costCents:cost,directExpenseCents:direct,profitCents:profit(revenue,cost,direct)}).returning({id:businessRecords.id});
      await syncBusinessFinance(tx,s.workspaceId,inserted[0].id,revenue,p.content,occurredAt);
      await syncCustomerLastBusiness(tx,s.workspaceId,customerId);
      return inserted;
    });
    createdId=row.id;
    await audit("create","business",row.id);
    result=ok("业务已记录");
  }catch(e){result=fail(actionError(e))}
  finish(createdId?[`/business/${createdId}`,"/business","/dashboard","/finance"]:["/business","/dashboard","/finance"],result);
}

export async function updateBusiness(data:FormData){
  let result:ActionResult;
  const rawId=String(data.get("id")??"");
  try{
    const s=await requireSession();
    const id=requiredUuid(data.get("id"),"业务");
    const p=z.object({customerId:z.string().optional().or(z.literal("")),productId:z.string().optional().or(z.literal("")),type:z.enum(["membership","account","physical","service","other"]),content:text(1,500),status:z.enum(["pending_payment","paid_pending","processing","completed","after_sale","refunded"]),occurredAt:z.string().optional()}).parse(Object.fromEntries(data));
    const revenue=parseRequiredMoney(data.get("revenue"),"收款");
    const cost=parseMoney(data.get("cost"),"成本");
    const direct=parseRequiredMoney(data.get("directExpense")??"0","直接支出");
    const customerId=await assertCustomer(s.workspaceId,optionalUuid(p.customerId??null));
    const productId=await assertProduct(s.workspaceId,optionalUuid(p.productId??null));
    const occurredAt=parseWhen(p.occurredAt??null);
    const db=getDb();
    const [existing]=await db.select({customerId:businessRecords.customerId}).from(businessRecords).where(and(eq(businessRecords.id,id),eq(businessRecords.workspaceId,s.workspaceId)));
    if(!existing)throw new Error("业务不存在或无权修改");
    await db.transaction(async tx=>{
      const updated=await tx.update(businessRecords).set({customerId,productId,type:p.type,content:p.content,status:p.status,occurredAt,revenueCents:revenue,costCents:cost,directExpenseCents:direct,profitCents:profit(revenue,cost,direct),updatedAt:new Date()}).where(and(eq(businessRecords.id,id),eq(businessRecords.workspaceId,s.workspaceId))).returning({id:businessRecords.id});
      if(!updated[0])throw new Error("业务不存在或无权修改");
      await syncBusinessFinance(tx,s.workspaceId,id,revenue,p.content,occurredAt);
      const touched=new Set([existing.customerId,customerId].filter(Boolean) as string[]);
      for(const cid of touched)await syncCustomerLastBusiness(tx,s.workspaceId,cid);
    });
    await audit("update","business",id);
    result=ok("业务已更新");
  }catch(e){result=fail(actionError(e))}
  finish(rawId?[`/business/${rawId}`,"/business","/dashboard","/finance"]:["/business","/dashboard","/finance"],result);
}

export async function deleteBusiness(data:FormData){
  let result:ActionResult;
  try{
    const s=await requireSession();
    const id=requiredUuid(data.get("id"),"业务");
    const db=getDb();
    const [existing]=await db.select({customerId:businessRecords.customerId}).from(businessRecords).where(and(eq(businessRecords.id,id),eq(businessRecords.workspaceId,s.workspaceId)));
    if(!existing)throw new Error("业务不存在或无权删除");
    await db.transaction(async tx=>{
      await tx.delete(financeTransactions).where(and(eq(financeTransactions.workspaceId,s.workspaceId),eq(financeTransactions.businessId,id)));
      const removed=await tx.delete(businessRecords).where(and(eq(businessRecords.id,id),eq(businessRecords.workspaceId,s.workspaceId))).returning({id:businessRecords.id});
      if(!removed[0])throw new Error("业务不存在或无权删除");
      if(existing.customerId)await syncCustomerLastBusiness(tx,s.workspaceId,existing.customerId);
    });
    await audit("delete","business",id);
    result=ok("业务已删除");
  }catch(e){result=fail(actionError(e))}
  finish(["/business","/dashboard","/finance"],result);
}

export async function createTask(data:FormData){
  let result:ActionResult;
  try{
    const s=await requireSession();
    const p=z.object({title:text(1,200),dueAt:z.string().optional()}).parse(Object.fromEntries(data));
    const [row]=await getDb().insert(tasks).values({workspaceId:s.workspaceId,title:p.title,dueAt:p.dueAt?parseWhen(p.dueAt):null}).returning({id:tasks.id});
    await audit("create","task",row.id);
    result=ok("待办已保存");
  }catch(e){result=fail(actionError(e))}
  finish("/tasks",result);
}

export async function toggleTask(data:FormData){
  let result:ActionResult;
  try{
    const s=await requireSession();
    const id=requiredUuid(data.get("id"),"待办");
    const done=data.get("done")==="1";
    const updated=await getDb().update(tasks).set({completedAt:done?null:new Date(),updatedAt:new Date()}).where(and(eq(tasks.id,id),eq(tasks.workspaceId,s.workspaceId))).returning({id:tasks.id});
    if(!updated[0])throw new Error("待办不存在或无权修改");
    await audit(done?"reopen":"complete","task",id);
    result=ok(done?"待办已重新打开":"待办已完成");
  }catch(e){result=fail(actionError(e))}
  finish(["/tasks","/dashboard"],result);
}

export async function createProduct(data:FormData){
  let result:ActionResult;
  try{
    const s=await requireSession();
    const p=z.object({name:text(1,160),type:z.enum(["membership","account","physical","service","other"]),category:z.string().trim().max(100)}).parse(Object.fromEntries(data));
    const [row]=await getDb().insert(products).values({workspaceId:s.workspaceId,...p,defaultPriceCents:parseRequiredMoney(data.get("price")??"0","默认售价"),defaultCostCents:parseRequiredMoney(data.get("cost")??"0","默认成本"),safetyStock:Number(data.get("safetyStock")??0)}).returning({id:products.id});
    await audit("create","product",row.id);
    result=ok("商品已保存");
  }catch(e){result=fail(actionError(e))}
  finish("/products",result);
}

export async function updateProduct(data:FormData){
  let result:ActionResult;
  try{
    const s=await requireSession();
    const id=requiredUuid(data.get("id"),"商品");
    const p=z.object({name:text(1,160),type:z.enum(["membership","account","physical","service","other"]),category:z.string().trim().max(100)}).parse(Object.fromEntries(data));
    const updated=await getDb().update(products).set({...p,defaultPriceCents:parseRequiredMoney(data.get("price")??"0","默认售价"),defaultCostCents:parseRequiredMoney(data.get("cost")??"0","默认成本"),safetyStock:Number(data.get("safetyStock")??0),updatedAt:new Date()}).where(and(eq(products.id,id),eq(products.workspaceId,s.workspaceId))).returning({id:products.id});
    if(!updated[0])throw new Error("商品不存在或无权修改");
    await audit("update","product",id);
    result=ok("商品已更新");
  }catch(e){result=fail(actionError(e))}
  finish("/products",result);
}

export async function archiveProduct(data:FormData){
  let result:ActionResult;
  try{
    const s=await requireSession();
    const id=requiredUuid(data.get("id"),"商品");
    const enabled=data.get("enabled")==="1";
    const updated=await getDb().update(products).set({enabled,updatedAt:new Date()}).where(and(eq(products.id,id),eq(products.workspaceId,s.workspaceId))).returning({id:products.id});
    if(!updated[0])throw new Error("商品不存在或无权修改");
    await audit(enabled?"restore":"archive","product",id);
    result=ok(enabled?"商品已恢复":"商品已归档");
  }catch(e){result=fail(actionError(e))}
  finish("/products",result);
}

export async function deleteProduct(data:FormData){
  let result:ActionResult;
  try{
    const s=await requireSession();
    const id=requiredUuid(data.get("id"),"商品");
    const linked=await getDb().select({id:businessRecords.id}).from(businessRecords).where(and(eq(businessRecords.workspaceId,s.workspaceId),eq(businessRecords.productId,id))).limit(1);
    if(linked[0])throw new Error("该商品仍有关联业务，请改为归档");
    const removed=await getDb().delete(products).where(and(eq(products.id,id),eq(products.workspaceId,s.workspaceId))).returning({id:products.id});
    if(!removed[0])throw new Error("商品不存在或无权删除");
    await audit("delete","product",id);
    result=ok("商品已删除");
  }catch(e){result=fail(actionError(e))}
  finish("/products",result);
}

export async function createWebsite(data:FormData){
  let result:ActionResult;
  try{
    const s=await requireSession();
    const p=z.object({name:text(1,120),url:z.url(),kind:z.enum(["self","third_party"]),notes:z.string().trim().max(500)}).parse(Object.fromEntries(data));
    const [row]=await getDb().insert(websites).values({workspaceId:s.workspaceId,...p}).returning({id:websites.id});
    await audit("create","website",row.id);
    result=ok("网站已保存");
  }catch(e){result=fail(actionError(e))}
  finish("/websites",result);
}

export async function updateWebsite(data:FormData){
  let result:ActionResult;
  try{
    const s=await requireSession();
    const id=requiredUuid(data.get("id"),"网站");
    const p=z.object({name:text(1,120),url:z.url(),kind:z.enum(["self","third_party"]),notes:z.string().trim().max(500)}).parse(Object.fromEntries(data));
    const updated=await getDb().update(websites).set({...p,updatedAt:new Date()}).where(and(eq(websites.id,id),eq(websites.workspaceId,s.workspaceId))).returning({id:websites.id});
    if(!updated[0])throw new Error("网站不存在或无权修改");
    await audit("update","website",id);
    result=ok("网站已更新");
  }catch(e){result=fail(actionError(e))}
  finish("/websites",result);
}

export async function deleteWebsite(data:FormData){
  let result:ActionResult;
  try{
    const s=await requireSession();
    const id=requiredUuid(data.get("id"),"网站");
    const removed=await getDb().delete(websites).where(and(eq(websites.id,id),eq(websites.workspaceId,s.workspaceId))).returning({id:websites.id});
    if(!removed[0])throw new Error("网站不存在或无权删除");
    await audit("delete","website",id);
    result=ok("网站已删除");
  }catch(e){result=fail(actionError(e))}
  finish("/websites",result);
}

export async function createFinance(data:FormData){
  let result:ActionResult;
  try{
    const s=await requireSession();
    const p=z.object({type:z.enum(["operating_expense","purchase","refund","other_income","other_expense"]),notes:z.string().trim().max(500),occurredAt:z.string().optional()}).parse(Object.fromEntries(data));
    const [row]=await getDb().insert(financeTransactions).values({workspaceId:s.workspaceId,type:p.type,occurredAt:parseWhen(p.occurredAt??null),amountCents:parseRequiredMoney(data.get("amount"),"金额"),notes:p.notes}).returning({id:financeTransactions.id});
    await audit("create","finance",String(row.id));
    result=ok("流水已记录");
  }catch(e){result=fail(actionError(e))}
  finish(["/finance","/dashboard"],result);
}

export async function updateFinance(data:FormData){
  let result:ActionResult;
  try{
    const s=await requireSession();
    const id=Number(data.get("id"));
    if(!Number.isFinite(id)||id<=0)throw new Error("缺少流水 ID");
    const p=z.object({type:z.enum(["operating_expense","purchase","refund","other_income","other_expense"]),notes:z.string().trim().max(500),occurredAt:z.string().optional()}).parse(Object.fromEntries(data));
    const [existing]=await getDb().select({businessId:financeTransactions.businessId}).from(financeTransactions).where(and(eq(financeTransactions.id,id),eq(financeTransactions.workspaceId,s.workspaceId)));
    if(!existing)throw new Error("流水不存在或无权修改");
    if(existing.businessId)throw new Error("业务自动生成的收款流水请在业务页面修改");
    const updated=await getDb().update(financeTransactions).set({type:p.type,occurredAt:parseWhen(p.occurredAt??null),amountCents:parseRequiredMoney(data.get("amount"),"金额"),notes:p.notes}).where(and(eq(financeTransactions.id,id),eq(financeTransactions.workspaceId,s.workspaceId))).returning({id:financeTransactions.id});
    if(!updated[0])throw new Error("流水不存在或无权修改");
    await audit("update","finance",String(id));
    result=ok("流水已更新");
  }catch(e){result=fail(actionError(e))}
  finish(["/finance","/dashboard"],result);
}

export async function deleteFinance(data:FormData){
  let result:ActionResult;
  try{
    const s=await requireSession();
    const id=Number(data.get("id"));
    if(!Number.isFinite(id)||id<=0)throw new Error("缺少流水 ID");
    const [existing]=await getDb().select({businessId:financeTransactions.businessId}).from(financeTransactions).where(and(eq(financeTransactions.id,id),eq(financeTransactions.workspaceId,s.workspaceId)));
    if(!existing)throw new Error("流水不存在或无权删除");
    if(existing.businessId)throw new Error("业务自动生成的收款流水请在业务页面删除");
    const removed=await getDb().delete(financeTransactions).where(and(eq(financeTransactions.id,id),eq(financeTransactions.workspaceId,s.workspaceId))).returning({id:financeTransactions.id});
    if(!removed[0])throw new Error("流水不存在或无权删除");
    await audit("delete","finance",String(id));
    result=ok("流水已删除");
  }catch(e){result=fail(actionError(e))}
  finish(["/finance","/dashboard"],result);
}

export async function createUsd(data:FormData){
  let result:ActionResult;
  try{
    const s=await requireSession();
    const type=z.enum(["recharge","consume"]).parse(data.get("type"));
    const usd=z.coerce.number().positive().parse(data.get("usd"));
    const db=getDb();
    await db.transaction(async tx=>{
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${s.workspaceId}))`);
      const [last]=await tx.select().from(usdTransactions).where(eq(usdTransactions.workspaceId,s.workspaceId)).orderBy(desc(usdTransactions.id)).limit(1);
      const pool={usd:Number(last?.balanceUsd??0),costCents:last?.balanceCostCents??0};
      if(type==="recharge"){
        const cost=parseRequiredMoney(data.get("cny"),"支付人民币");
        const next=recharge(pool,usd,cost);
        await tx.insert(usdTransactions).values({workspaceId:s.workspaceId,type,occurredAt:new Date(),usdAmount:String(usd),cnyAmountCents:cost,balanceUsd:String(next.usd),balanceCostCents:next.costCents,averageCost:String(averageCost(next))});
      }else{
        const resultConsume=consume(pool,usd);
        await tx.insert(usdTransactions).values({workspaceId:s.workspaceId,type,occurredAt:new Date(),usdAmount:String(-usd),cnyAmountCents:resultConsume.costCents,balanceUsd:String(resultConsume.pool.usd),balanceCostCents:resultConsume.pool.costCents,averageCost:String(averageCost(resultConsume.pool))});
      }
    });
    await audit("create",`usd_${type}`,s.workspaceId);
    result=ok("美元流水已记录");
  }catch(e){result=fail(actionError(e))}
  finish("/finance",result);
}

export async function createMembership(data:FormData){
  let result:ActionResult;
  let createdId="";
  try{
    const s=await requireSession();
    const p=z.object({customerId:text(1,36),platform:text(1,80),planName:text(1,120),startedAt:z.string().optional(),expiresAt:z.string().min(1),notes:z.string().trim().max(1000)}).parse(Object.fromEntries(data));
    const customerId=requiredUuid(p.customerId,"客户");
    await assertCustomer(s.workspaceId,customerId);
    const startedAt=parseWhen(p.startedAt??null);
    const expiresAt=parseWhen(p.expiresAt);
    if(expiresAt<=startedAt)throw new Error("到期时间必须晚于开始时间");
    const revenue=parseRequiredMoney(data.get("revenue")??"0","售价");
    const cost=parseMoney(data.get("cost"),"成本");
    const [row]=await getDb().insert(membershipSubscriptions).values({workspaceId:s.workspaceId,customerId,platform:p.platform,planName:p.planName,startedAt,expiresAt,revenueCents:revenue,costCents:cost,status:"active",notes:p.notes||null}).returning({id:membershipSubscriptions.id});
    createdId=row.id;
    await audit("create","membership",row.id);
    await syncMembershipReminderTasks(s.workspaceId);
    result=ok("会员订阅已保存");
  }catch(e){result=fail(actionError(e))}
  finish(createdId?[`/memberships/${createdId}`,"/memberships","/dashboard"]:["/memberships","/dashboard"],result);
}

export async function updateMembership(data:FormData){
  let result:ActionResult;
  const rawId=String(data.get("id")??"");
  try{
    const s=await requireSession();
    const id=requiredUuid(data.get("id"),"会员");
    const p=z.object({customerId:text(1,36),platform:text(1,80),planName:text(1,120),startedAt:z.string().optional(),expiresAt:z.string().min(1),status:z.enum(["active","expired","cancelled"]),notes:z.string().trim().max(1000)}).parse(Object.fromEntries(data));
    const customerId=requiredUuid(p.customerId,"客户");
    await assertCustomer(s.workspaceId,customerId);
    const startedAt=parseWhen(p.startedAt??null);
    const expiresAt=parseWhen(p.expiresAt);
    if(expiresAt<=startedAt)throw new Error("到期时间必须晚于开始时间");
    const revenue=parseRequiredMoney(data.get("revenue")??"0","售价");
    const cost=parseMoney(data.get("cost"),"成本");
    const updated=await getDb().update(membershipSubscriptions).set({customerId,platform:p.platform,planName:p.planName,startedAt,expiresAt,revenueCents:revenue,costCents:cost,status:p.status,notes:p.notes||null,updatedAt:new Date()}).where(and(eq(membershipSubscriptions.id,id),eq(membershipSubscriptions.workspaceId,s.workspaceId))).returning({id:membershipSubscriptions.id});
    if(!updated[0])throw new Error("会员订阅不存在或无权修改");
    await audit("update","membership",id);
    await syncMembershipReminderTasks(s.workspaceId);
    result=ok("会员订阅已更新");
  }catch(e){result=fail(actionError(e))}
  finish(rawId?[`/memberships/${rawId}`,"/memberships","/dashboard"]:["/memberships","/dashboard"],result);
}

export async function renewMembership(data:FormData){
  let result:ActionResult;
  const rawId=String(data.get("id")??"");
  try{
    const s=await requireSession();
    const id=requiredUuid(data.get("id"),"会员");
    const p=z.object({newExpiresAt:z.string().min(1),notes:z.string().trim().max(1000)}).parse(Object.fromEntries(data));
    const newExpiresAt=parseWhen(p.newExpiresAt);
    const revenue=parseRequiredMoney(data.get("revenue")??"0","续费售价");
    const cost=parseMoney(data.get("cost"),"续费成本");
    const db=getDb();
    const [existing]=await db.select().from(membershipSubscriptions).where(and(eq(membershipSubscriptions.id,id),eq(membershipSubscriptions.workspaceId,s.workspaceId)));
    if(!existing)throw new Error("会员订阅不存在或无权续费");
    if(newExpiresAt<=existing.expiresAt)throw new Error("续费后的到期时间必须晚于当前到期时间");
    await db.transaction(async tx=>{
      await tx.insert(membershipRenewals).values({workspaceId:s.workspaceId,subscriptionId:id,renewedAt:new Date(),previousExpiresAt:existing.expiresAt,newExpiresAt,revenueCents:revenue,costCents:cost,notes:p.notes||null});
      await tx.update(membershipSubscriptions).set({expiresAt:newExpiresAt,status:"active",revenueCents:existing.revenueCents+revenue,costCents:(existing.costCents??0)+(cost??0),updatedAt:new Date()}).where(and(eq(membershipSubscriptions.id,id),eq(membershipSubscriptions.workspaceId,s.workspaceId)));
    });
    await audit("renew","membership",id);
    await syncMembershipReminderTasks(s.workspaceId);
    result=ok("续费已记录");
  }catch(e){result=fail(actionError(e))}
  finish(rawId?[`/memberships/${rawId}`,"/memberships","/dashboard"]:["/memberships","/dashboard"],result);
}

export async function deleteMembership(data:FormData){
  let result:ActionResult;
  try{
    const s=await requireSession();
    const id=requiredUuid(data.get("id"),"会员");
    const db=getDb();
    await db.delete(membershipRenewals).where(and(eq(membershipRenewals.subscriptionId,id),eq(membershipRenewals.workspaceId,s.workspaceId)));
    const removed=await db.delete(membershipSubscriptions).where(and(eq(membershipSubscriptions.id,id),eq(membershipSubscriptions.workspaceId,s.workspaceId))).returning({id:membershipSubscriptions.id});
    if(!removed[0])throw new Error("会员订阅不存在或无权删除");
    await audit("delete","membership",id);
    result=ok("会员订阅已删除");
  }catch(e){result=fail(actionError(e))}
  finish(["/memberships","/dashboard"],result);
}

