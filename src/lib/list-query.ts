import {and,eq,gte,ilike,lte,or,count,type SQL} from "drizzle-orm";
import {getDb} from "@/db";
import {businessRecords,customers,financeTransactions,products,websites} from "@/db/schema";

export type ListQuery={q?:string;from?:string;to?:string;page?:string;pageSize?:number};

export function listOffset(pageRaw?:string,pageSize=20){
  const page=Math.max(1,Number(pageRaw??"1")||1);
  return{page,offset:(page-1)*pageSize,pageSize};
}

export function customerFilter(workspaceId:string,q?:string):SQL{
  const base=eq(customers.workspaceId,workspaceId);
  if(!q?.trim())return base;
  const term=`%${q.trim()}%`;
  return and(base,or(ilike(customers.name,term),ilike(customers.phone,term),ilike(customers.wechat,term)))!;
}

export function businessFilter(workspaceId:string,q?:string,from?:string,to?:string):SQL{
  const parts:SQL[]=[eq(businessRecords.workspaceId,workspaceId)];
  if(q?.trim()){const term=`%${q.trim()}%`;parts.push(or(ilike(businessRecords.content,term),ilike(businessRecords.number,term))!)}
  if(from){const d=new Date(from);if(!Number.isNaN(d.getTime()))parts.push(gte(businessRecords.occurredAt,d))}
  if(to){const d=new Date(`${to}T23:59:59`);if(!Number.isNaN(d.getTime()))parts.push(lte(businessRecords.occurredAt,d))}
  return parts.length===1?parts[0]:and(...parts)!;
}

export async function countRows(table:typeof customers|typeof businessRecords|typeof products|typeof websites|typeof financeTransactions,where:SQL){
  const [row]=await getDb().select({total:count()}).from(table).where(where);
  return Number(row?.total??0);
}
