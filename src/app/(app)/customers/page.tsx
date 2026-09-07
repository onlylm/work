import Link from "next/link";
import {desc} from "drizzle-orm";
import {getDb} from "@/db";
import {customers} from "@/db/schema";
import {requireSession} from "@/lib/auth";
import {datetime} from "@/lib/format";
import {ConfirmSubmitButton} from "@/components/delete-button";
import {FlashBanner} from "@/components/flash-banner";
import {ListToolbar} from "@/components/list-toolbar";
import {Empty,PageHeader} from "@/components/ui";
import {countRows,customerFilter,listOffset} from "@/lib/list-query";
import {createCustomer,deleteCustomer,updateCustomer} from "../actions";

export const dynamic="force-dynamic";
const PAGE_SIZE=20;

export default async function CustomersPage({searchParams}:{searchParams:Promise<{q?:string;page?:string;success?:string;error?:string}>}){
  const {q,page:pageRaw,success,error}=await searchParams;
  const s=await requireSession();
  const where=customerFilter(s.workspaceId,q);
  const {page,offset,pageSize}=listOffset(pageRaw,PAGE_SIZE);
  const total=await countRows(customers,where);
  const totalPages=Math.max(1,Math.ceil(total/pageSize));
  const rows=await getDb().select().from(customers).where(where).orderBy(desc(customers.createdAt)).limit(pageSize).offset(offset);
  return <div className="page">
    <PageHeader title="客户管理" description="保存客户资料，业务记录会自动汇总到客户名下"/>
    <FlashBanner success={success} error={error}/>
    <details className="form-disclosure"><summary>＋ 新增客户</summary>
      <form action={createCustomer} className="data-form">
        <label>客户姓名<input name="name" required maxLength={120}/></label>
        <label>手机号<input name="phone" maxLength={32}/></label>
        <label>微信号<input name="wechat" maxLength={80}/></label>
        <label className="wide">备注<textarea name="notes" maxLength={1000}/></label>
        <button>保存客户</button>
      </form>
    </details>
    <section className="content-card list-card">
      <header><div><h3>全部客户</h3><p>共 {total} 位客户</p></div></header>
      <ListToolbar action="/customers" search={q} page={page} totalPages={totalPages} placeholder="搜索姓名、手机或微信"/>
      {rows.length?<div className="data-table"><table><thead><tr><th>客户</th><th>手机</th><th>微信</th><th>最近业务</th><th>创建时间</th><th>操作</th></tr></thead><tbody>
        {rows.map(x=><tr key={x.id}><td><Link href={`/customers/${x.id}`}><b>{x.name}</b></Link></td><td>{x.phone||"—"}</td><td>{x.wechat||"—"}</td><td>{x.lastBusinessAt?datetime(x.lastBusinessAt):"暂无"}</td><td>{datetime(x.createdAt)}</td><td className="row-actions"><Link href={`/customers/${x.id}`}>详情</Link><details><summary>编辑</summary>
          <form action={updateCustomer} className="data-form inline-form">
            <input type="hidden" name="id" value={x.id}/>
            <label>客户姓名<input name="name" required defaultValue={x.name} maxLength={120}/></label>
            <label>手机号<input name="phone" defaultValue={x.phone??""} maxLength={32}/></label>
            <label>微信号<input name="wechat" defaultValue={x.wechat??""} maxLength={80}/></label>
            <label className="wide">备注<textarea name="notes" defaultValue={x.notes??""} maxLength={1000}/></label>
            <button>保存修改</button>
          </form>
          <form action={deleteCustomer} className="inline-delete"><input type="hidden" name="id" value={x.id}/><ConfirmSubmitButton label="删除" confirmText={`确认删除客户「${x.name}」？`}/></form>
        </details></td></tr>)}
      </tbody></table></div>:<Empty title="还没有客户" description="新增第一位客户后，可为其记录业务"/>}
    </section>
  </div>;
}
