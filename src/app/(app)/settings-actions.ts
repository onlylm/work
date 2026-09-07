"use server";
import {compare,hash} from "bcryptjs";
import {eq} from "drizzle-orm";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {z} from "zod";
import {getDb} from "@/db";
import {auditLogs,customers,users} from "@/db/schema";
import {actionError,fail,ok,type ActionResult} from "@/lib/action-result";
import {clearSession,createSession,requireSession} from "@/lib/auth";
import {parseCsv} from "@/lib/csv";
import {pingIntegration,type IntegrationName} from "@/lib/integrations";

async function audit(action:string,entityType:string,entityId:string,metadata?:Record<string,unknown>){
  const s=await requireSession();
  await getDb().insert(auditLogs).values({workspaceId:s.workspaceId,userId:s.userId,action,entityType,entityId,metadata});
}

function finish(result:ActionResult){
  revalidatePath("/settings");
  if(!result.ok)redirect(`/settings?error=${encodeURIComponent(result.error)}`);
  if(result.message)redirect(`/settings?success=${encodeURIComponent(result.message)}`);
  redirect("/settings");
}

export async function changePassword(data:FormData){
  let result:ActionResult;
  try{
    const s=await requireSession();
    const p=z.object({currentPassword:z.string().min(8).max(128),newPassword:z.string().min(8).max(128),confirmPassword:z.string().min(8).max(128)}).parse(Object.fromEntries(data));
    if(p.newPassword!==p.confirmPassword)throw new Error("两次输入的新密码不一致");
    if(p.currentPassword===p.newPassword)throw new Error("新密码不能与当前密码相同");
    const db=getDb();
    const [user]=await db.select().from(users).where(eq(users.id,s.userId)).limit(1);
    if(!user||!await compare(p.currentPassword,user.passwordHash))throw new Error("当前密码不正确");
    const passwordHash=await hash(p.newPassword,12);
    const [updated]=await db.update(users).set({passwordHash,sessionVersion:user.sessionVersion+1,updatedAt:new Date()}).where(eq(users.id,s.userId)).returning({sessionVersion:users.sessionVersion});
    if(!updated)throw new Error("密码更新失败");
    await audit("change_password","user",s.userId);
    await createSession({...s,sessionVersion:updated.sessionVersion});
    result=ok("密码已修改，其他设备上的会话已失效");
  }catch(e){result=fail(actionError(e))}
  finish(result);
}

export async function revokeAllSessions(data:FormData){
  let result:ActionResult;
  try{
    const s=await requireSession();
    const password=z.string().min(8).max(128).parse(data.get("password"));
    const [user]=await getDb().select().from(users).where(eq(users.id,s.userId)).limit(1);
    if(!user||!await compare(password,user.passwordHash))throw new Error("密码不正确");
    const [updated]=await getDb().update(users).set({sessionVersion:user.sessionVersion+1,updatedAt:new Date()}).where(eq(users.id,s.userId)).returning({sessionVersion:users.sessionVersion});
    if(!updated)throw new Error("操作失败");
    await audit("revoke_sessions","user",s.userId);
    await createSession({...s,sessionVersion:updated.sessionVersion});
    result=ok("已使其他设备会话失效");
  }catch(e){result=fail(actionError(e))}
  finish(result);
}

export async function importCustomersCsv(data:FormData){
  let result:ActionResult;
  try{
    const s=await requireSession();
    const text=z.string().trim().min(1).parse(data.get("csv"));
    const rows=parseCsv(text);
    if(rows.length<2)throw new Error("CSV 至少需要表头与一行数据");
    const header=rows[0].map(x=>x.trim().toLowerCase());
    const nameIdx=header.findIndex(x=>["姓名","name","客户"].includes(x));
    if(nameIdx<0)throw new Error("CSV 必须包含「姓名」或 name 列");
    const phoneIdx=header.findIndex(x=>["手机","phone","手机号"].includes(x));
    const wechatIdx=header.findIndex(x=>["微信","wechat"].includes(x));
    const notesIdx=header.findIndex(x=>["备注","notes"].includes(x));
    let inserted=0;
    const db=getDb();
    for(const row of rows.slice(1)){
      const name=row[nameIdx]?.trim();
      if(!name)continue;
      await db.insert(customers).values({workspaceId:s.workspaceId,name,phone:phoneIdx>=0?row[phoneIdx]?.trim()||null:null,wechat:wechatIdx>=0?row[wechatIdx]?.trim()||null:null,notes:notesIdx>=0?row[notesIdx]?.trim()||null:null});
      inserted++;
    }
    await audit("import","customer",s.workspaceId,{count:inserted});
    result=ok(`已导入 ${inserted} 位客户`);
  }catch(e){result=fail(actionError(e))}
  revalidatePath("/customers");
  finish(result);
}

const integrationNames=new Set<IntegrationName>(["shuku","nimail"]);

export async function testIntegration(data:FormData){
  let result:ActionResult;
  try{
    await requireSession();
    const name=z.string().parse(data.get("name"));
    if(!integrationNames.has(name as IntegrationName))throw new Error("未知集成");
    const ping=await pingIntegration(name as IntegrationName);
    result=ping.ok?ok(`${name}：${ping.message}`):fail(`${name}：${ping.message}`);
  }catch(e){result=fail(actionError(e))}
  finish(result);
}
