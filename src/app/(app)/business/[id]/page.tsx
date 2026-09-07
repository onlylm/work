import Link from "next/link";
import {notFound} from "next/navigation";
import {and,eq} from "drizzle-orm";
import {getDb} from "@/db";
import {businessRecords,customers,financeTransactions,products} from "@/db/schema";
import {requireSession} from "@/lib/auth";
import {businessStatusName,businessTypeName,cny,datetime,datetimeLocal} from "@/lib/format";
import {BusinessCreateForm} from "@/components/business-create-form";
import {ConfirmSubmitButton} from "@/components/delete-button";
import {FlashBanner} from "@/components/flash-banner";
import {PageHeader} from "@/components/ui";
import {deleteBusiness,updateBusiness} from "../../actions";

export const dynamic="force-dynamic";

export default async function BusinessDetailPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{success?:string;error?:string}>}){
  const {id}=await params;
  const {success,error}=await searchParams;
  const s=await requireSession();
  const db=getDb();
  const [row]=await db.select().from(businessRecords).where(and(eq(businessRecords.id,id),eq(businessRecords.workspaceId,s.workspaceId))).limit(1);
  if(!row)notFound();
  const [clientRows,productRows,receipts]=await Promise.all([
    db.select().from(customers).where(eq(customers.workspaceId,s.workspaceId)).orderBy(customers.name),
    db.select().from(products).where(eq(products.workspaceId,s.workspaceId)).orderBy(products.name),
    db.select().from(financeTransactions).where(and(eq(financeTransactions.workspaceId,s.workspaceId),eq(financeTransactions.businessId,id))),
  ]);
  const editProducts=productRows.filter(p=>p.enabled||p.id===row.productId).map(p=>({id:p.id,name:p.enabled?p.name:`${p.name}（已归档）`,type:p.type,defaultPriceCents:p.defaultPriceCents,defaultCostCents:p.defaultCostCents}));
  const customerName=clientRows.find(c=>c.id===row.customerId)?.name;
  const productName=productRows.find(p=>p.id===row.productId)?.name;
  return <div className="page">
    <PageHeader title={row.content} description={`编号 ${row.number}`}/>
    <FlashBanner success={success} error={error}/>
    <p className="detail-back"><Link href="/business">← 返回业务列表</Link></p>
    <div className="detail-grid">
      <section className="content-card">
        <header><div><h3>业务摘要</h3><p>{datetime(row.occurredAt)}</p></div></header>
        <dl className="detail-dl">
          <div><dt>类型</dt><dd>{businessTypeName[row.type]}</dd></div>
          <div><dt>状态</dt><dd>{businessStatusName[row.status]}</dd></div>
          <div><dt>客户</dt><dd>{customerName? <Link href={`/customers/${row.customerId}`}>{customerName}</Link>:"未关联"}</dd></div>
          <div><dt>商品</dt><dd>{productName||"未关联"}</dd></div>
          <div><dt>收款</dt><dd>{cny(row.revenueCents)}</dd></div>
          <div><dt>成本</dt><dd>{cny(row.costCents)}</dd></div>
          <div><dt>直接支出</dt><dd>{cny(row.directExpenseCents)}</dd></div>
          <div><dt>利润</dt><dd>{cny(row.profitCents)}</dd></div>
        </dl>
        <div className="detail-receipts">
          <h4>关联收款流水</h4>
          {receipts.length?receipts.map(x=><p key={x.id}>{cny(x.amountCents)} · {datetime(x.occurredAt)} · {x.notes||"客户收款"}</p>):<p className="muted">无自动生成的收款流水</p>}
        </div>
      </section>
      <section className="content-card">
        <header><div><h3>编辑业务</h3><p>修改后会同步收款流水与客户最近业务时间</p></div></header>
        <BusinessCreateForm
          recordId={row.id}
          submitLabel="保存修改"
          customers={clientRows}
          products={editProducts}
          action={updateBusiness}
          defaults={{customerId:row.customerId??"",productId:row.productId??"",type:row.type,content:row.content,revenue:String(row.revenueCents/100),cost:row.costCents!=null?String(row.costCents/100):"",directExpense:String(row.directExpenseCents/100),occurredAt:datetimeLocal(row.occurredAt),status:row.status}}
        />
        <form action={deleteBusiness} className="inline-delete"><input type="hidden" name="id" value={row.id}/><ConfirmSubmitButton label="删除业务" confirmText={`确认删除业务「${row.content}」？关联收款流水也会删除。`}/></form>
      </section>
    </div>
  </div>;
}
