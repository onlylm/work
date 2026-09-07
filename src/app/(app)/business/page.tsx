import Link from "next/link";
import {desc,eq} from "drizzle-orm";
import {getDb} from "@/db";
import {businessRecords,customers,products} from "@/db/schema";
import {requireSession} from "@/lib/auth";
import {businessStatusName,businessTypeName,cny,datetime,datetimeLocal} from "@/lib/format";
import {BusinessCreateForm} from "@/components/business-create-form";
import {ConfirmSubmitButton} from "@/components/delete-button";
import {FlashBanner} from "@/components/flash-banner";
import {ListToolbar} from "@/components/list-toolbar";
import {Empty,PageHeader} from "@/components/ui";
import {businessFilter,countRows,listOffset} from "@/lib/list-query";
import {createBusiness,deleteBusiness,updateBusiness} from "../actions";

export const dynamic="force-dynamic";
const PAGE_SIZE=20;

export default async function BusinessPage({searchParams}:{searchParams:Promise<{q?:string;from?:string;to?:string;page?:string;success?:string;error?:string}>}){
  const {q,from,to,page:pageRaw,success,error}=await searchParams;
  const s=await requireSession();
  const db=getDb();
  const where=businessFilter(s.workspaceId,q,from,to);
  const {page,offset,pageSize}=listOffset(pageRaw,PAGE_SIZE);
  const total=await countRows(businessRecords,where);
  const totalPages=Math.max(1,Math.ceil(total/pageSize));
  const [rows,clientRows,productRows]=await Promise.all([
    db.select().from(businessRecords).where(where).orderBy(desc(businessRecords.occurredAt)).limit(pageSize).offset(offset),
    db.select().from(customers).where(eq(customers.workspaceId,s.workspaceId)).orderBy(customers.name),
    db.select().from(products).where(eq(products.workspaceId,s.workspaceId)).orderBy(products.name),
  ]);
  const toOption=(x:typeof productRows[number])=>({id:x.id,name:x.enabled?x.name:`${x.name}（已归档）`,type:x.type,defaultPriceCents:x.defaultPriceCents,defaultCostCents:x.defaultCostCents});
  const activeProducts=productRows.filter(x=>x.enabled).map(toOption);
  return <div className="page">
    <PageHeader title="业务流水" description="业务只录一次，统一保存收款、成本、利润与状态"/>
    <FlashBanner success={success} error={error}/>
    <details className="form-disclosure"><summary>＋ 记录新业务</summary>
      <BusinessCreateForm customers={clientRows} products={activeProducts} action={createBusiness}/>
    </details>
    <section className="content-card list-card">
      <header><div><h3>全部业务</h3><p>共 {total} 条记录</p></div></header>
      <ListToolbar action="/business" search={q} from={from} to={to} page={page} totalPages={totalPages} placeholder="搜索编号或内容" showDate/>
      {rows.length?<div className="data-table"><table><thead><tr><th>编号</th><th>内容</th><th>类型</th><th>收款</th><th>成本</th><th>利润</th><th>状态</th><th>时间</th><th>操作</th></tr></thead><tbody>
        {rows.map(x=>{
          const editProducts=productRows.filter(p=>p.enabled||p.id===x.productId).map(toOption);
          return <tr key={x.id}><td><Link href={`/business/${x.id}`}>{x.number}</Link></td><td><Link href={`/business/${x.id}`}><b>{x.content}</b></Link></td><td>{businessTypeName[x.type]}</td><td>{cny(x.revenueCents)}</td><td>{cny(x.costCents)}</td><td>{cny(x.profitCents)}</td><td><span className="tag">{businessStatusName[x.status]}</span></td><td>{datetime(x.occurredAt)}</td><td className="row-actions"><Link href={`/business/${x.id}`}>详情</Link><details><summary>编辑</summary>
          <BusinessCreateForm recordId={x.id} submitLabel="保存修改" customers={clientRows} products={editProducts} action={updateBusiness} defaults={{customerId:x.customerId??"",productId:x.productId??"",type:x.type,content:x.content,revenue:String(x.revenueCents/100),cost:x.costCents!=null?String(x.costCents/100):"",directExpense:String(x.directExpenseCents/100),occurredAt:datetimeLocal(x.occurredAt),status:x.status}}/>
          <form action={deleteBusiness} className="inline-delete"><input type="hidden" name="id" value={x.id}/><ConfirmSubmitButton label="删除" confirmText={`确认删除业务「${x.content}」？关联收款流水也会删除。`}/></form>
        </details></td></tr>;
        })}
      </tbody></table></div>:<Empty title="还没有业务流水" description="录入首笔业务后，资金和利润会自动计算"/>}
    </section>
  </div>;
}
