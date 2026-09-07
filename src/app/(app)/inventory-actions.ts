"use server";
import {and,eq} from "drizzle-orm";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {cookies} from "next/headers";
import {z} from "zod";
import {getDb} from "@/db";
import {auditLogs,businessRecords,inventoryItems} from "@/db/schema";
import {requireSession} from "@/lib/auth";
import {actionError,fail,ok,type ActionResult} from "@/lib/action-result";
import {requiredUuid,text} from "@/lib/form-parse";
import {applyStockMovement,claimInventoryItem,importInventoryLines,revealInventoryOnce} from "@/lib/inventory";

async function audit(action:string,entityType:string,entityId:string,metadata?:Record<string,unknown>){
  const s=await requireSession();
  await getDb().insert(auditLogs).values({workspaceId:s.workspaceId,userId:s.userId,action,entityType,entityId,metadata});
}

function finish(paths:string|string[],result:ActionResult){
  for(const path of Array.isArray(paths)?paths:[paths])revalidatePath(path);
  const target=Array.isArray(paths)?paths[0]:paths;
  if(!result.ok)redirect(`${target}?error=${encodeURIComponent(result.error)}`);
  if(result.message)redirect(`${target}?success=${encodeURIComponent(result.message)}`);
  redirect(target);
}

export async function importInventory(data:FormData){
  let result:ActionResult;
  const productId=String(data.get("productId")??"");
  try{
    const s=await requireSession();
    const id=requiredUuid(data.get("productId"),"商品");
    const lines=z.string().trim().min(1).parse(data.get("lines"));
    const rows=lines.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    if(!rows.length)throw new Error("请至少输入一行库存内容");
    const {inserted,skipped}=await importInventoryLines(s.workspaceId,id,rows);
    await audit("import","inventory_product",id,{inserted,skipped});
    result=ok(`已导入 ${inserted} 条${skipped?`，跳过重复 ${skipped} 条`:""}`);
  }catch(e){result=fail(actionError(e))}
  finish(productId?[`/products/${productId}`,"/products"]:"/products",result);
}

export async function claimInventory(data:FormData){
  try{
    const s=await requireSession();
    const bid=requiredUuid(data.get("businessId"),"业务");
    const productId=requiredUuid(data.get("productId"),"商品");
    const [biz]=await getDb().select({id:businessRecords.id}).from(businessRecords).where(and(eq(businessRecords.id,bid),eq(businessRecords.workspaceId,s.workspaceId)));
    if(!biz)throw new Error("业务不存在或无权操作");
    const itemId=await claimInventoryItem(s.workspaceId,productId,bid);
    await audit("claim","inventory_item",String(itemId),{businessId:bid,productId});
    redirect(`/business/${bid}/reveal/${itemId}`);
  }catch(e){
    const businessId=String(data.get("businessId")??"");
    finish(businessId?[`/business/${businessId}`,"/business"]:"/business",fail(actionError(e)));
  }
}

export async function confirmReveal(data:FormData){
  try{
    const s=await requireSession();
    const businessId=requiredUuid(data.get("businessId"),"业务");
    const itemId=Number(data.get("itemId"));
    if(!Number.isFinite(itemId)||itemId<=0)throw new Error("缺少库存 ID");
    const {plain}=await revealInventoryOnce(s.workspaceId,itemId,s.userId);
    await audit("reveal","inventory_item",String(itemId),{businessId});
    (await cookies()).set(`inv_reveal_${itemId}`,plain,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",maxAge:120,path:`/business/${businessId}/reveal/${itemId}`});
    redirect(`/business/${businessId}/reveal/${itemId}`);
  }catch(e){
    const businessId=String(data.get("businessId")??"");
    finish(businessId?[`/business/${businessId}/reveal/${data.get("itemId")}`,"/business"]:"/business",fail(actionError(e)));
  }
}

export async function recordStockMovement(data:FormData){
  let result:ActionResult;
  const productId=String(data.get("productId")??"");
  try{
    const s=await requireSession();
    const id=requiredUuid(data.get("productId"),"商品");
    const type=z.enum(["in","out","adjust"]).parse(data.get("type"));
    const quantity=z.coerce.number().int().positive().parse(data.get("quantity"));
    const notes=z.string().trim().max(500).optional().parse(data.get("notes")??undefined);
    const balance=await applyStockMovement(s.workspaceId,id,type,quantity,notes);
    await audit(type==="in"?"stock_in":type==="out"?"stock_out":"stock_adjust","product",id,{quantity,balance});
    result=ok(`库存已更新，当前 ${balance} 件`);
  }catch(e){result=fail(actionError(e))}
  finish(productId?[`/products/${productId}`,"/products"]:"/products",result);
}

export async function deleteInventoryItem(data:FormData){
  let result:ActionResult;
  const productId=String(data.get("productId")??"");
  try{
    const s=await requireSession();
    const id=Number(data.get("itemId"));
    requiredUuid(data.get("productId"),"商品");
    if(!Number.isFinite(id)||id<=0)throw new Error("缺少库存 ID");
    const removed=await getDb().delete(inventoryItems).where(and(eq(inventoryItems.id,id),eq(inventoryItems.workspaceId,s.workspaceId),eq(inventoryItems.status,"available"))).returning({id:inventoryItems.id});
    if(!removed[0])throw new Error("只能删除未领取的库存");
    await audit("delete","inventory_item",String(id));
    result=ok("库存已删除");
  }catch(e){result=fail(actionError(e))}
  finish(productId?[`/products/${productId}`,"/products"]:"/products",result);
}
