import {eq} from "drizzle-orm";
import {getDb} from "@/db";
import {businessRecords,customers,financeTransactions,products} from "@/db/schema";
import {toCsv} from "@/lib/csv";
import {businessStatusName,businessTypeName,datetime} from "@/lib/format";

export async function exportCustomersCsv(workspaceId:string){
  const rows=await getDb().select().from(customers).where(eq(customers.workspaceId,workspaceId)).orderBy(customers.name);
  return toCsv(["姓名","手机","微信","备注","最近业务","创建时间"],rows.map(x=>[x.name,x.phone??"",x.wechat??"",x.notes??"",x.lastBusinessAt?datetime(x.lastBusinessAt):"",datetime(x.createdAt)]));
}

export async function exportBusinessCsv(workspaceId:string){
  const rows=await getDb().select().from(businessRecords).where(eq(businessRecords.workspaceId,workspaceId)).orderBy(businessRecords.occurredAt);
  return toCsv(["编号","内容","类型","状态","收款元","成本元","利润元","业务时间"],rows.map(x=>[x.number,x.content,businessTypeName[x.type]??x.type,businessStatusName[x.status]??x.status,(x.revenueCents/100).toFixed(2),x.costCents!=null?(x.costCents/100).toFixed(2):"",x.profitCents!=null?(x.profitCents/100).toFixed(2):"",datetime(x.occurredAt)]));
}

export async function exportFinanceCsv(workspaceId:string){
  const typeName:Record<string,string>={customer_receipt:"客户收款",operating_expense:"经营支出",purchase:"商品采购",refund:"退款",other_income:"其他收入",other_expense:"其他支出"};
  const rows=await getDb().select().from(financeTransactions).where(eq(financeTransactions.workspaceId,workspaceId)).orderBy(financeTransactions.occurredAt);
  return toCsv(["类型","金额元","说明","时间","关联业务"],rows.map(x=>[typeName[x.type]??x.type,(x.amountCents/100).toFixed(2),x.notes??"",datetime(x.occurredAt),x.businessId??""]));
}

export async function exportProductsCsv(workspaceId:string){
  const rows=await getDb().select().from(products).where(eq(products.workspaceId,workspaceId)).orderBy(products.name);
  return toCsv(["名称","类型","分类","默认售价元","默认成本元","库存","安全库存","状态"],rows.map(x=>[x.name,businessTypeName[x.type]??x.type,x.category??"",((x.defaultPriceCents??0)/100).toFixed(2),((x.defaultCostCents??0)/100).toFixed(2),String(x.type==="physical"?x.stockQuantity:"—"),String(x.safetyStock),x.enabled?"启用":"已归档"]));
}

export type ExportKind="customers"|"business"|"finance"|"products";

export async function exportCsv(workspaceId:string,kind:ExportKind){
  if(kind==="customers")return exportCustomersCsv(workspaceId);
  if(kind==="business")return exportBusinessCsv(workspaceId);
  if(kind==="finance")return exportFinanceCsv(workspaceId);
  return exportProductsCsv(workspaceId);
}

export function exportFilename(kind:ExportKind){
  const stamp=new Date().toISOString().slice(0,10);
  return `${kind}-${stamp}.csv`;
}
