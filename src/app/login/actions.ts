"use server";
import {compare} from "bcryptjs";
import {and,eq,gte} from "drizzle-orm";
import {redirect} from "next/navigation";
import {z} from "zod";
import {getDb} from "@/db";
import {loginAttempts,users,workspaceMembers} from "@/db/schema";
import {createSession,clearSession} from "@/lib/auth";

const loginSchema=z.object({email:z.email(),password:z.string().min(8).max(128)});
export async function loginAction(formData:FormData){
  const parsed=loginSchema.safeParse({email:formData.get("email"),password:formData.get("password")});
  if(!parsed.success)redirect("/login?error=请输入正确的邮箱和密码");
  const db=getDb();
  const email=parsed.data.email.toLowerCase();const cutoff=new Date(Date.now()-15*60*1000);
  const recent=await db.select({id:loginAttempts.id}).from(loginAttempts).where(and(eq(loginAttempts.email,email),gte(loginAttempts.createdAt,cutoff))).limit(5);
  if(recent.length>=5)redirect("/login?error=失败次数过多，请15分钟后重试");
  const [user]=await db.select().from(users).where(eq(users.email,email)).limit(1);
  if(!user||!await compare(parsed.data.password,user.passwordHash)){await db.insert(loginAttempts).values({email});redirect("/login?error=邮箱或密码错误")}
  await db.delete(loginAttempts).where(eq(loginAttempts.email,email));
  const [member]=await db.select().from(workspaceMembers).where(eq(workspaceMembers.userId,user.id)).limit(1);
  if(!member)redirect("/login?error=账号尚未加入工作空间");
  await createSession({userId:user.id,workspaceId:member.workspaceId,name:user.name,email:user.email});
  redirect("/dashboard");
}
export async function logoutAction(){await clearSession();redirect("/login")}
