import {NextResponse} from "next/server";
import {requireApiSession} from "@/lib/auth";
import {listBackups} from "@/lib/backups";

export async function GET(){
  const s=await requireApiSession();
  if(!s)return NextResponse.json({error:"未登录"},{status:401});
  const files=await listBackups();
  return NextResponse.json({files,dir:process.env.BACKUP_DIR?.trim()||"/backups"});
}
