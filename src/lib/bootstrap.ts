import {hash} from "bcryptjs";
import {eq} from "drizzle-orm";
import {getDb} from "@/db";
import {users,workspaceMembers,workspaces} from "@/db/schema";

export async function ensureAdmin(){
  const email=process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password=process.env.ADMIN_PASSWORD;
  if(!email||!password)throw new Error("管理员初始化信息未配置");
  const db=getDb();
  const existing=await db.select({id:users.id}).from(users).where(eq(users.email,email)).limit(1);
  if(existing.length)return;
  const passwordHash=await hash(password,12);
  await db.transaction(async tx=>{
    const [workspace]=await tx.insert(workspaces).values({name:"我的经营工作空间"}).returning({id:workspaces.id});
    const [user]=await tx.insert(users).values({email,passwordHash,name:"管理员"}).returning({id:users.id});
    await tx.insert(workspaceMembers).values({workspaceId:workspace.id,userId:user.id,role:"owner"});
  });
}
