import Link from "next/link";
import {notFound} from "next/navigation";
import {and,desc,eq} from "drizzle-orm";
import {getDb} from "@/db";
import {customers,membershipRenewals,membershipSubscriptions} from "@/db/schema";
import {requireSession} from "@/lib/auth";
import {cny,dateOnly,datetime,datetimeLocal,membershipStatusName} from "@/lib/format";
import {daysUntil,syncMembershipReminderTasks} from "@/lib/membership";
import {ConfirmSubmitButton} from "@/components/delete-button";
import {FlashBanner} from "@/components/flash-banner";
import {PageHeader} from "@/components/ui";
import {deleteMembership,renewMembership,updateMembership} from "../../actions";

export const dynamic="force-dynamic";

export default async function MembershipDetailPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{success?:string;error?:string}>}){
  const {id}=await params;
  const {success,error}=await searchParams;
  const s=await requireSession();
  await syncMembershipReminderTasks(s.workspaceId);
  const db=getDb();
  const [row]=await db.select({
    subscription:membershipSubscriptions,
    customerName:customers.name,
  }).from(membershipSubscriptions).innerJoin(customers,and(eq(customers.id,membershipSubscriptions.customerId),eq(customers.workspaceId,s.workspaceId))).where(and(eq(membershipSubscriptions.id,id),eq(membershipSubscriptions.workspaceId,s.workspaceId))).limit(1);
  if(!row)notFound();
  const sub=row.subscription;
  const renewals=await db.select().from(membershipRenewals).where(and(eq(membershipRenewals.subscriptionId,id),eq(membershipRenewals.workspaceId,s.workspaceId))).orderBy(desc(membershipRenewals.renewedAt));
  const clientRows=await db.select().from(customers).where(eq(customers.workspaceId,s.workspaceId)).orderBy(customers.name);
  const left=daysUntil(sub.expiresAt);
  return <div className="page">
    <PageHeader title={`${row.customerName} · ${sub.platform}`} description={`${sub.planName} · ${membershipStatusName[sub.status]}`}/>
    <FlashBanner success={success} error={error}/>
    <p className="detail-back"><Link href="/memberships">← 返回会员列表</Link></p>
    <div className="detail-grid">
      <section className="content-card">
        <header><div><h3>订阅信息</h3><p>{left>=0?`还有 ${left} 天到期`:"已过期"}</p></div></header>
        <dl className="detail-dl">
          <div><dt>客户</dt><dd><Link href={`/customers/${sub.customerId}`}>{row.customerName}</Link></dd></div>
          <div><dt>平台</dt><dd>{sub.platform}</dd></div>
          <div><dt>套餐</dt><dd>{sub.planName}</dd></div>
          <div><dt>开始时间</dt><dd>{datetime(sub.startedAt)}</dd></div>
          <div><dt>到期时间</dt><dd>{datetime(sub.expiresAt)}</dd></div>
          <div><dt>累计售价</dt><dd>{cny(sub.revenueCents)}</dd></div>
          <div><dt>累计成本</dt><dd>{cny(sub.costCents)}</dd></div>
          <div className="full"><dt>备注</dt><dd>{sub.notes||"—"}</dd></div>
        </dl>
        <details open className="form-disclosure"><summary>编辑订阅</summary>
          <form action={updateMembership} className="data-form">
            <input type="hidden" name="id" value={sub.id}/>
            <label>客户<select name="customerId" defaultValue={sub.customerId} required>{clientRows.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
            <label>平台<input name="platform" required defaultValue={sub.platform} maxLength={80}/></label>
            <label>套餐<input name="planName" required defaultValue={sub.planName} maxLength={120}/></label>
            <label>开始时间<input name="startedAt" type="datetime-local" defaultValue={datetimeLocal(sub.startedAt)}/></label>
            <label>到期时间<input name="expiresAt" type="datetime-local" required defaultValue={datetimeLocal(sub.expiresAt)}/></label>
            <label>累计售价（元）<input name="revenue" type="number" min="0" step="0.01" defaultValue={String(sub.revenueCents/100)}/></label>
            <label>累计成本（元）<input name="cost" type="number" min="0" step="0.01" defaultValue={sub.costCents!=null?String(sub.costCents/100):""}/></label>
            <label>状态<select name="status" defaultValue={sub.status}><option value="active">生效中</option><option value="expired">已到期</option><option value="cancelled">已取消</option></select></label>
            <label className="wide">备注<textarea name="notes" defaultValue={sub.notes??""} maxLength={1000}/></label>
            <button>保存修改</button>
          </form>
          <form action={deleteMembership} className="inline-delete"><input type="hidden" name="id" value={sub.id}/><ConfirmSubmitButton label="删除订阅" confirmText={`确认删除「${sub.platform} · ${sub.planName}」？续费历史也会删除。`}/></form>
        </details>
      </section>
      <section className="content-card">
        <header><div><h3>续费记录</h3><p>共 {renewals.length} 次</p></div></header>
        {renewals.length?<div className="simple-list">{renewals.map(x=><div key={x.id}><div><b>{dateOnly(x.newExpiresAt)} 到期</b><small>{datetime(x.renewedAt)} · 售价 {cny(x.revenueCents)}{x.notes?` · ${x.notes}`:""}</small></div><strong>{cny(x.revenueCents)}</strong></div>)}</div>:<p className="muted">还没有续费记录</p>}
        <details className="form-disclosure" style={{marginTop:16}}><summary>＋ 记录续费</summary>
          <form action={renewMembership} className="data-form one">
            <input type="hidden" name="id" value={sub.id}/>
            <label>新到期时间<input name="newExpiresAt" type="datetime-local" required defaultValue={datetimeLocal(sub.expiresAt)}/></label>
            <label>续费售价（元）<input name="revenue" type="number" min="0" step="0.01" defaultValue="0"/></label>
            <label>续费成本（元）<input name="cost" type="number" min="0" step="0.01"/></label>
            <label className="wide">备注<input name="notes" maxLength={1000}/></label>
            <button>保存续费</button>
          </form>
        </details>
      </section>
    </div>
  </div>;
}
