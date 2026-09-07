import {NextResponse} from "next/server";
import {requireApiSession} from "@/lib/auth";
import {exportCsv,exportFilename,type ExportKind} from "@/lib/export-data";

const kinds=new Set<ExportKind>(["customers","business","finance","products"]);

export async function GET(_:Request,ctx:{params:Promise<{kind:string}>}){
  const s=await requireApiSession();
  if(!s)return NextResponse.json({error:"未登录"}, {status:401});
  const {kind}=await ctx.params;
  if(!kinds.has(kind as ExportKind))return NextResponse.json({error:"不支持的导出类型"}, {status:400});
  const csv=await exportCsv(s.workspaceId,kind as ExportKind);
  return new NextResponse(csv,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="${exportFilename(kind as ExportKind)}"`}});
}
