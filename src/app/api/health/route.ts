import {sql} from "drizzle-orm";
import {getDb} from "@/db";

export const dynamic="force-dynamic";

export async function GET(){
  try{
    await getDb().execute(sql`select 1 from users limit 1`);
    return Response.json({ok:true,database:"ready",service:"personal-business-workbench",version:"0.2.1",time:new Date().toISOString()});
  }catch(error){
    console.error("健康检查：数据库未就绪",error);
    return Response.json({ok:false,database:"unavailable",service:"personal-business-workbench",version:"0.2.1",time:new Date().toISOString()},{status:503});
  }
}
