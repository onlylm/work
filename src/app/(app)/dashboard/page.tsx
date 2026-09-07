import Link from "next/link";
import {and,desc,eq,gte,isNull} from "drizzle-orm";
import {ArrowRight,BriefcaseBusiness,CircleDollarSign,ClipboardCheck,CreditCard,TrendingUp,Users} from "lucide-react";
import {getDb} from "@/db";
import {businessRecords,customers,financeTransactions,tasks,usdTransactions} from "@/db/schema";
import {requireSession} from "@/lib/auth";
import {businessStatusName,businessTypeName,cny,dateOnly,datetime} from "@/lib/format";
import {daysUntil,listExpiringMemberships,syncMembershipReminderTasks} from "@/lib/membership";
import {Empty} from "@/components/ui";

export const dynamic="force-dynamic";

export default async function Dashboard(){
  const s=await requireSession();
  const db=getDb();
  await syncMembershipReminderTasks(s.workspaceId);
  const start=new Date();
  start.setHours(0,0,0,0);
  const [business,customerRows,pending,finance,lastUsd,expiring]=await Promise.all([
    db.select().from(businessRecords).where(and(eq(businessRecords.workspaceId,s.workspaceId),gte(businessRecords.occurredAt,start))).orderBy(desc(businessRecords.occurredAt)),
    db.select({id:customers.id}).from(customers).where(eq(customers.workspaceId,s.workspaceId)),
    db.select().from(tasks).where(and(eq(tasks.workspaceId,s.workspaceId),isNull(tasks.completedAt))).orderBy(tasks.dueAt).limit(5),
    db.select().from(financeTransactions).where(and(eq(financeTransactions.workspaceId,s.workspaceId),gte(financeTransactions.occurredAt,start))),
    db.select().from(usdTransactions).where(eq(usdTransactions.workspaceId,s.workspaceId)).orderBy(desc(usdTransactions.id)).limit(1),
    listExpiringMemberships(s.workspaceId,30),
  ]);
  const revenue=business.reduce((n,x)=>n+x.revenueCents,0);
  const profitTotal=business.reduce((n,x)=>n+(x.profitCents??0),0);
  const expenses=finance.filter(x=>["operating_expense","other_expense"].includes(x.type)).reduce((n,x)=>n+x.amountCents,0);
  return <div className="page dashboard">
    <div className="dashboard-hero">
      <div><span>今日经营概览</span><h2>{new Intl.DateTimeFormat("zh-CN",{month:"long",day:"numeric",weekday:"long"}).format(new Date())}</h2><p>只显示今天最重要的数据和待办事项。</p></div>
      <Link href="/business" className="main-button">记录一笔业务 <ArrowRight/></Link>
    </div>
    <div className="stat-grid">{[["今日收款",cny(revenue),CircleDollarSign],["已核算利润",cny(profitTotal),TrendingUp],["经营支出",cny(expenses),BriefcaseBusiness],["客户总数",`${customerRows.length} 人`,Users]].map(([label,value,Icon])=><article key={String(label)}><span><Icon/></span><div><p>{String(label)}</p><strong>{String(value)}</strong></div></article>)}</div>
    {expiring.length>0&&<section className="content-card membership-alert">
      <header><div><h3>会员到期提醒</h3><p>30 天内即将到期</p></div><Link href="/memberships?filter=expiring">查看全部 <ArrowRight/></Link></header>
      <div className="simple-list">{expiring.slice(0,5).map(x=>{
        const left=daysUntil(x.expiresAt);
        return <Link key={x.id} href={`/memberships/${x.id}`} className="simple-list-link"><div><span className="list-icon"><CreditCard/></span><div><b>{x.customerName} · {x.platform}</b><small>{x.planName} · {dateOnly(x.expiresAt)} · 还有 {left} 天</small></div></div><strong>{left}天</strong></Link>;
      })}</div>
    </section>}
    <div className="dashboard-grid">
      <section className="content-card"><header><div><h3>最近业务</h3><p>今天录入的业务记录</p></div><Link href="/business">查看全部 <ArrowRight/></Link></header>{business.length?<div className="simple-list">{business.slice(0,6).map(x=><div key={x.id}><span className="list-icon"><BriefcaseBusiness/></span><div><b>{x.content}</b><small>{businessTypeName[x.type]} · {businessStatusName[x.status]} · {datetime(x.occurredAt)}</small></div><strong>{cny(x.revenueCents)}</strong></div>)}</div>:<Empty title="今天还没有业务" description="点击“记录一笔业务”开始使用"/>}</section>
      <section className="content-card"><header><div><h3>待办事项</h3><p>优先处理未完成任务</p></div><Link href="/tasks">管理待办 <ArrowRight/></Link></header>{pending.length?<div className="task-list">{pending.map(x=><div key={x.id}><ClipboardCheck/><div><b>{x.title}</b><small>{x.dueAt?`截止 ${datetime(x.dueAt)}`:"未设置截止时间"}</small></div></div>)}</div>:<Empty title="没有待办" description="当前没有需要处理的事项"/>}</section>
    </div>
    <section className="fund-strip"><div><p>美元余额</p><strong>${Number(lastUsd[0]?.balanceUsd??0).toFixed(2)}</strong></div><div><p>人民币成本余额</p><strong>{cny(lastUsd[0]?.balanceCostCents??0)}</strong></div><div><p>当前平均成本</p><strong>¥{Number(lastUsd[0]?.averageCost??0).toFixed(4)} / USD</strong></div><Link href="/finance">管理美元资金 <ArrowRight/></Link></section>
  </div>;
}
