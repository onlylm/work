import {createReadStream} from "node:fs";
import {stat} from "node:fs/promises";
import {Readable} from "node:stream";
import {NextResponse} from "next/server";
import {requireApiSession} from "@/lib/auth";
import {assertBackupFilename} from "@/lib/backups";

export async function GET(_:Request,ctx:{params:Promise<{name:string}>}){
  const s=await requireApiSession();
  if(!s)return NextResponse.json({error:"未登录"},{status:401});
  const {name}=await ctx.params;
  let filePath:string;
  try{
    filePath=assertBackupFilename(name);
  }catch{
    return NextResponse.json({error:"无效的备份文件"},{status:400});
  }
  try{
    const info=await stat(filePath);
    if(!info.isFile())return NextResponse.json({error:"备份不存在"},{status:404});
    const stream=Readable.toWeb(createReadStream(filePath)) as ReadableStream;
    return new NextResponse(stream,{
      headers:{
        "Content-Type":"application/octet-stream",
        "Content-Disposition":`attachment; filename="${name}"`,
        "Content-Length":String(info.size),
      },
    });
  }catch{
    return NextResponse.json({error:"备份不存在或不可读"},{status:404});
  }
}
