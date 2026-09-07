import Link from "next/link";
import {and,eq,gt,ilike,lte,or,type SQL,count} from "drizzle-orm";
import {getDb} from "@/db";
import {customers,membershipSubscriptions} from "@/db/schema";
import {requireSession} from "@/lib/auth";
import {cny,dateOnly,membershipStatusName} from "@/lib/format";
import {daysUntil as calcDaysUntil,syncMembershipReminderTasks} from "@/lib/membership";
import {FlashBanner} from "@/components/flash-banner";
import {Empty,PageHeader} from "@/components/ui";
import {listOffset} from "@/lib/list-query";
import {createMembership} from "../actions";

export const dynamic="force-dynamic";
const PAGE_SIZE=20;

function membershipFilter(workspaceId:string,q?:string,filter?:string):SQL{
  const parts:SQL[]=[eq(membershipSubscriptions.workspaceId,workspaceId)];
  if(q?.trim()){
    const term=`%${q.trim()}%`;
    parts.push(or(ilike(membershipSubscriptions.platform,term),ilike(membershipSubscriptions.planName,term),ilike(customers.name,term))!);
  }
  const now=new Date();
  if(filter==="expiring"){
    const until=new Date();
    until.setDate(until.getDate()+30);
    until.setHours(23,59,59,999);
    parts.push(eq(membershipSubscriptions.status,"active"),gt(membershipSubscriptions.expiresAt,now),lte(membershipSubscriptions.expiresAt,until));
  }else if(filter==="expired"){
    parts.push(or(eq(membershipSubscriptions.status,"expired"),lte(membershipSubscriptions.expiresAt,now))!);
  }else if(filter==="active"){
    parts.push(eq(membershipSubscriptions.status,"active"),gt(membershipSubscriptions.expiresAt,now));
  }
  return parts.length===1?parts[0]:and(...parts)!;
}

export default async function MembershipsPage({searchParams}:{searchParams:Promise<{q?:string;filter?:string;page?:string;success?:string;error?:string}>}){
  const {q,filter,page:pageRaw,success,error}=await searchParams;
  const s=await requireSession();
  await syncMembershipReminderTasks(s.workspaceId);
  const db=getDb();
  const where=membershipFilter(s.workspaceId,q,filter);
  const {page,offset,pageSize}=listOffset(pageRaw,PAGE_SIZE);
  const baseQuery=db.select({
    id:membershipSubscriptions.id,
    platform:membershipSubscriptions.platform,
    planName:membershipSubscriptions.planName,
    startedAt:membershipSubscriptions.startedAt,
    expiresAt:membershipSubscriptions.expiresAt,
    revenueCents:membershipSubscriptions.revenueCents,
    costCents:membershipSubscriptions.costCents,
    status:membershipSubscriptions.status,
    customerId:membershipSubscriptions.customerId,
    customerName:customers.name,
  }).from(membershipSubscriptions).innerJoin(customers,and(eq(customers.id,membershipSubscriptions.customerId),eq(customers.workspaceId,s.workspaceId))).where(where);
  const rows=await baseQuery.orderBy(membershipSubscriptions.expiresAt).limit(pageSize).offset(offset);
  const [countRow]=await db.select({total:count()}).from(membershipSubscriptions).innerJoin(customers,and(eq(customers.id,membershipSubscriptions.customerId),eq(customers.workspaceId,s.workspaceId))).where(where);
  const total=Number(countRow?.total??0);
  const totalPages=Math.max(1,Math.ceil(total/pageSize));
  const clientRows=await db.select().from(customers).where(eq(customers.workspaceId,s.workspaceId)).orderBy(customers.name);
  return <div className="page">
    <PageHeader title="会员管理" description="记录平台会员的开始与到期时间，续费保留历史，并自动生成到期提醒待办"/>
    <FlashBanner success={success} error={error}/>
    <details className="form-disclosure"><summary>＋ 新增会员订阅</summary>
      <form action={createMembership} className="data-form">
        <label>客户<select name="customerId" required><option value="">选择客户</option>{clientRows.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label>平台<input name="platform" required maxLength={80} placeholder="例如 Netflix / Spotify"/></label>
        <label>套餐<input name="planName" required maxLength={120} placeholder="例如 家庭版 / 年付"/></label>
        <label>开始时间<input name="startedAt" type="datetime-local"/></label>
        <label>到期时间<input name="expiresAt" type="datetime-local" required/></label>
        <label>售价（元）<input name="revenue" type="number" min="0" step="0.01" defaultValue="0"/></label>
        <label>成本（元，可留空）<input name="cost" type="number" min="0" step="0.01"/></label>
        <label className="wide">备注<textarea name="notes" maxLength={1000}/></label>
        <button>保存订阅</button>
      </form>
    </details>
    <section className="content-card list-card">
      <header><div><h3>全部会员</h3><p>共 {total} 条订阅</p></div></header>
      <form action="/memberships" method="get" className="list-toolbar">
        <input name="q" defaultValue={q??""} placeholder="搜索客户、平台或套餐"/>
        <select name="filter" defaultValue={filter??""} aria-label="状态筛选">
          <option value="">全部</option>
          <option value="active">生效中</option>
          <option value="expiring">30 天内到期</option>
          <option value="expired">已到期</option>
        </select>
        <button type="submit">筛选</button>
      </form>
      {rows.length?<div className="data-table"><table><thead><tr><th>客户</th><th>平台</th><th>套餐</th><th>到期</th><th>剩余</th><th>累计售价</th><th>状态</th><th>操作</th></tr></thead><tbody>
        {rows.map(x=>{
          const left=calcDaysUntil(x.expiresAt);
          const urgent=left<=7&&left>=0;
          return <tr key={x.id} className={urgent?"urgent-row":""}><td><Link href={`/customers/${x.customerId}`}>{x.customerName}</Link></td><td>{x.platform}</td><td>{x.planName}</td><td>{dateOnly(x.expiresAt)}</td><td>{left>=0?`${left} 天`:"已过期"}</td><td>{cny(x.revenueCents)}</td><td><span className="tag">{membershipStatusName[x.status]??x.status}</span></td><td className="row-actions"><Link href={`/memberships/${x.id}`}>详情</Link></td></tr>;
        })}
      </tbody></table></div>:<Empty title="暂无会员订阅" description="新增会员订阅后，系统会在到期前 7/3/1 天自动生成待办"/>}
      {totalPages>1&&<div className="list-toolbar pager-only"><div className="pager">
        {page>1&&<Link href={`/memberships?${new URLSearchParams({...(q?{q}:{}),...(filter?{filter}:{}),page:String(page-1)}).toString()}`}>上一页</Link>}
        <span>{page} / {totalPages}</span>
        {page<totalPages&&<Link href={`/memberships?${new URLSearchParams({...(q?{q}:{}),...(filter?{filter}:{}),page:String(page+1)}).toString()}`}>下一页</Link>}
      </div></div>}
    </section>
  </div>;
}
