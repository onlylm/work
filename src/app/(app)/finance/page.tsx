import {desc,eq} from "drizzle-orm";
import {getDb} from "@/db";
import {financeTransactions,usdTransactions} from "@/db/schema";
import {requireSession} from "@/lib/auth";
import {cny,datetime,datetimeLocal} from "@/lib/format";
import {ConfirmSubmitButton} from "@/components/delete-button";
import {FlashBanner} from "@/components/flash-banner";
import {ListToolbar} from "@/components/list-toolbar";
import {Empty,PageHeader} from "@/components/ui";
import {listOffset} from "@/lib/list-query";
import {createFinance,createUsd,deleteFinance,updateFinance} from "../actions";
import {and,gte,lte,ilike,count} from "drizzle-orm";

export const dynamic="force-dynamic";
const financeName:Record<string,string>={customer_receipt:"客户收款",operating_expense:"经营支出",purchase:"商品采购",refund:"退款",other_income:"其他收入",other_expense:"其他支出"};
const PAGE_SIZE=20;

function financeFilter(workspaceId:string,q?:string,from?:string,to?:string){
  const parts=[eq(financeTransactions.workspaceId,workspaceId)];
  if(q?.trim())parts.push(ilike(financeTransactions.notes,`%${q.trim()}%`));
  if(from){const d=new Date(from);if(!Number.isNaN(d.getTime()))parts.push(gte(financeTransactions.occurredAt,d))}
  if(to){const d=new Date(`${to}T23:59:59`);if(!Number.isNaN(d.getTime()))parts.push(lte(financeTransactions.occurredAt,d))}
  return parts.length===1?parts[0]:and(...parts)!;
}

export default async function FinancePage({searchParams}:{searchParams:Promise<{q?:string;from?:string;to?:string;page?:string;success?:string;error?:string}>}){
  const {q,from,to,page:pageRaw,success,error}=await searchParams;
  const s=await requireSession();
  const db=getDb();
  const where=financeFilter(s.workspaceId,q,from,to);
  const {page,offset,pageSize}=listOffset(pageRaw,PAGE_SIZE);
  const [countRow]=await db.select({total:count()}).from(financeTransactions).where(where);
  const total=Number(countRow?.total??0);
  const totalPages=Math.max(1,Math.ceil(total/pageSize));
  const [rows,usdRows]=await Promise.all([
    db.select().from(financeTransactions).where(where).orderBy(desc(financeTransactions.occurredAt)).limit(pageSize).offset(offset),
    db.select().from(usdTransactions).where(eq(usdTransactions.workspaceId,s.workspaceId)).orderBy(desc(usdTransactions.id)).limit(50),
  ]);
  const latest=usdRows[0];
  return <div className="page">
    <PageHeader title="资金流水" description="人民币流水与美元资金分开记录，历史成本不会随汇率变化"/>
    <FlashBanner success={success} error={error}/>
    <div className="finance-summary">
      <article><p>当前美元余额</p><strong>${Number(latest?.balanceUsd??0).toFixed(2)}</strong></article>
      <article><p>美元人民币成本</p><strong>{cny(latest?.balanceCostCents??0)}</strong></article>
      <article><p>移动平均成本</p><strong>¥{Number(latest?.averageCost??0).toFixed(4)}</strong></article>
    </div>
    <div className="two-forms">
      <details className="form-disclosure"><summary>＋ 记录人民币流水</summary>
        <form action={createFinance} className="data-form one">
          <label>类型<select name="type"><option value="operating_expense">经营支出</option><option value="purchase">商品采购</option><option value="refund">退款</option><option value="other_income">其他收入</option><option value="other_expense">其他支出</option></select></label>
          <label>金额（元）<input name="amount" type="number" min="0" step="0.01" required/></label>
          <label>发生时间<input name="occurredAt" type="datetime-local"/></label>
          <label>说明<input name="notes"/></label>
          <button>记录流水</button>
        </form>
      </details>
      <details className="form-disclosure"><summary>＋ 美元充值或消费</summary>
        <form action={createUsd} className="data-form one">
          <label>类型<select name="type"><option value="recharge">人民币充值美元</option><option value="consume">客户续费消耗美元</option></select></label>
          <label>美元金额<input name="usd" type="number" min="0.0001" step="0.0001" required/></label>
          <label>支付人民币（消费时填 0）<input name="cny" type="number" min="0" step="0.01" defaultValue="0" required/></label>
          <button>确认记录</button>
        </form>
      </details>
    </div>
    <div className="dashboard-grid">
      <section className="content-card list-card">
        <header><div><h3>人民币流水</h3><p>共 {total} 条</p></div></header>
        <ListToolbar action="/finance" search={q} from={from} to={to} page={page} totalPages={totalPages} placeholder="搜索说明" showDate/>
        {rows.length?<div className="simple-list">{rows.map(x=><div key={x.id}>
          <div><b>{financeName[x.type]??x.type}</b><small>{x.notes||datetime(x.occurredAt)}{x.businessId?" · 来自业务":""}</small></div>
          <strong>{cny(x.amountCents)}</strong>
          {!x.businessId&&<details className="row-inline-edit"><summary>编辑</summary>
            <form action={updateFinance} className="data-form inline-form">
              <input type="hidden" name="id" value={x.id}/>
              <label>类型<select name="type" defaultValue={x.type}><option value="operating_expense">经营支出</option><option value="purchase">商品采购</option><option value="refund">退款</option><option value="other_income">其他收入</option><option value="other_expense">其他支出</option></select></label>
              <label>金额（元）<input name="amount" type="number" min="0" step="0.01" defaultValue={String(x.amountCents/100)} required/></label>
              <label>发生时间<input name="occurredAt" type="datetime-local" defaultValue={datetimeLocal(x.occurredAt)}/></label>
              <label>说明<input name="notes" defaultValue={x.notes??""}/></label>
              <button>保存修改</button>
            </form>
            <form action={deleteFinance} className="inline-delete"><input type="hidden" name="id" value={x.id}/><ConfirmSubmitButton label="删除" confirmText="确认删除这条流水？"/></form>
          </details>}
        </div>)}</div>:<Empty title="暂无人民币流水" description="业务收款会自动同步到这里"/>}
      </section>
      <section className="content-card list-card">
        <header><div><h3>美元流水</h3><p>采用移动加权平均成本</p></div></header>
        {usdRows.length?<div className="simple-list">{usdRows.map(x=><div key={x.id}><div><b>{x.type==="recharge"?"充值美元":"消耗美元"}</b><small>{datetime(x.occurredAt)} · 余额 ${x.balanceUsd}</small></div><strong>{Number(x.usdAmount)>0?"+":""}${x.usdAmount}</strong></div>)}</div>:<Empty title="暂无美元流水" description="首次充值后开始计算移动平均成本"/>}
      </section>
    </div>
  </div>;
}
