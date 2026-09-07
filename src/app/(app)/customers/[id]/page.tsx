import Link from "next/link";
import {notFound} from "next/navigation";
import {and,desc,eq} from "drizzle-orm";
import {getDb} from "@/db";
import {businessRecords,customers} from "@/db/schema";
import {requireSession} from "@/lib/auth";
import {businessStatusName,businessTypeName,cny,datetime} from "@/lib/format";
import {ConfirmSubmitButton} from "@/components/delete-button";
import {FlashBanner} from "@/components/flash-banner";
import {Empty,PageHeader} from "@/components/ui";
import {deleteCustomer,updateCustomer} from "../../actions";

export const dynamic="force-dynamic";

export default async function CustomerDetailPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{success?:string;error?:string}>}){
  const {id}=await params;
  const {success,error}=await searchParams;
  const s=await requireSession();
  const db=getDb();
  const [customer]=await db.select().from(customers).where(and(eq(customers.id,id),eq(customers.workspaceId,s.workspaceId))).limit(1);
  if(!customer)notFound();
  const businesses=await db.select().from(businessRecords).where(and(eq(businessRecords.workspaceId,s.workspaceId),eq(businessRecords.customerId,id))).orderBy(desc(businessRecords.occurredAt)).limit(50);
  return <div className="page">
    <PageHeader title={customer.name} description="客户详情、近期业务与资料编辑"/>
    <FlashBanner success={success} error={error}/>
    <p className="detail-back"><Link href="/customers">← 返回客户列表</Link></p>
    <div className="detail-grid">
      <section className="content-card">
        <header><div><h3>基本资料</h3><p>创建于 {datetime(customer.createdAt)}</p></div></header>
        <dl className="detail-dl">
          <div><dt>手机</dt><dd>{customer.phone||"—"}</dd></div>
          <div><dt>微信</dt><dd>{customer.wechat||"—"}</dd></div>
          <div><dt>最近业务</dt><dd>{customer.lastBusinessAt?datetime(customer.lastBusinessAt):"暂无"}</dd></div>
          <div className="full"><dt>备注</dt><dd>{customer.notes||"—"}</dd></div>
        </dl>
        <details open className="form-disclosure"><summary>编辑资料</summary>
          <form action={updateCustomer} className="data-form">
            <input type="hidden" name="id" value={customer.id}/>
            <label>客户姓名<input name="name" required defaultValue={customer.name} maxLength={120}/></label>
            <label>手机号<input name="phone" defaultValue={customer.phone??""} maxLength={32}/></label>
            <label>微信号<input name="wechat" defaultValue={customer.wechat??""} maxLength={80}/></label>
            <label className="wide">备注<textarea name="notes" defaultValue={customer.notes??""} maxLength={1000}/></label>
            <button>保存修改</button>
          </form>
          <form action={deleteCustomer} className="inline-delete"><input type="hidden" name="id" value={customer.id}/><ConfirmSubmitButton label="删除客户" confirmText={`确认删除客户「${customer.name}」？`}/></form>
        </details>
      </section>
      <section className="content-card list-card">
        <header><div><h3>近期业务</h3><p>最近 {businesses.length} 条</p></div><Link href="/business">去记一笔</Link></header>
        {businesses.length?<div className="simple-list">{businesses.map(x=><Link key={x.id} href={`/business/${x.id}`} className="simple-list-link">
          <div><b>{x.content}</b><small>{businessTypeName[x.type]} · {businessStatusName[x.status]} · {datetime(x.occurredAt)}</small></div>
          <strong>{cny(x.revenueCents)}</strong>
        </Link>)}</div>:<Empty title="暂无业务" description="为该客户记录第一笔业务后会显示在这里"/>}
      </section>
    </div>
  </div>;
}
