import Link from "next/link";
import {desc,eq} from "drizzle-orm";
import {getDb} from "@/db";
import {products} from "@/db/schema";
import {requireSession} from "@/lib/auth";
import {businessTypeName,cny} from "@/lib/format";
import {ConfirmSubmitButton} from "@/components/delete-button";
import {FlashBanner} from "@/components/flash-banner";
import {ListToolbar} from "@/components/list-toolbar";
import {Empty,PageHeader} from "@/components/ui";
import {listOffset} from "@/lib/list-query";
import {archiveProduct,createProduct,deleteProduct,updateProduct} from "../actions";
import {and,ilike,or,count} from "drizzle-orm";

export const dynamic="force-dynamic";
const PAGE_SIZE=20;

function productFilter(workspaceId:string,q?:string){
  const base=eq(products.workspaceId,workspaceId);
  if(!q?.trim())return base;
  const term=`%${q.trim()}%`;
  return and(base,or(ilike(products.name,term),ilike(products.category,term)))!;
}

export default async function ProductsPage({searchParams}:{searchParams:Promise<{q?:string;page?:string;success?:string;error?:string}>}){
  const {q,page:pageRaw,success,error}=await searchParams;
  const s=await requireSession();
  const where=productFilter(s.workspaceId,q);
  const {page,offset,pageSize}=listOffset(pageRaw,PAGE_SIZE);
  const db=getDb();
  const [countRow]=await db.select({total:count()}).from(products).where(where);
  const total=Number(countRow?.total??0);
  const totalPages=Math.max(1,Math.ceil(total/pageSize));
  const rows=await db.select().from(products).where(where).orderBy(desc(products.createdAt)).limit(pageSize).offset(offset);
  return <div className="page">
    <PageHeader title="商品与库存" description="维护会员、账号、实物及服务商品的基础资料"/>
    <FlashBanner success={success} error={error}/>
    <details className="form-disclosure"><summary>＋ 新增商品</summary>
      <form action={createProduct} className="data-form">
        <label>商品名称<input name="name" required/></label>
        <label>商品类型<select name="type"><option value="membership">会员充值</option><option value="account">账号产品</option><option value="physical">实物产品</option><option value="service">服务</option><option value="other">其他</option></select></label>
        <label>分类<input name="category"/></label>
        <label>默认售价（元）<input name="price" type="number" min="0" step="0.01" defaultValue="0"/></label>
        <label>默认成本（元）<input name="cost" type="number" min="0" step="0.01" defaultValue="0"/></label>
        <label>安全库存<input name="safetyStock" type="number" min="0" step="1" defaultValue="0"/></label>
        <button>保存商品</button>
      </form>
    </details>
    <section className="content-card list-card">
      <header><div><h3>全部商品</h3><p>共 {total} 个商品</p></div></header>
      <ListToolbar action="/products" search={q} page={page} totalPages={totalPages} placeholder="搜索商品名称或分类"/>
      {rows.length?<div className="data-table"><table><thead><tr><th>商品名称</th><th>类型</th><th>分类</th><th>库存</th><th>默认售价</th><th>状态</th><th>操作</th></tr></thead><tbody>
        {rows.map(x=><tr key={x.id} className={x.enabled?"":"muted-row"}><td><Link href={`/products/${x.id}`}><b>{x.name}</b></Link></td><td>{businessTypeName[x.type]}</td><td>{x.category||"—"}</td><td>{x.type==="physical"?`${x.stockQuantity} 件`:x.type==="account"?"卡密": "—"}</td><td>{cny(x.defaultPriceCents)}</td><td>{x.enabled?"启用":"已归档"}</td><td className="row-actions"><Link href={`/products/${x.id}`}>详情</Link><details><summary>编辑</summary>
          <form action={updateProduct} className="data-form inline-form">
            <input type="hidden" name="id" value={x.id}/>
            <label>商品名称<input name="name" required defaultValue={x.name}/></label>
            <label>商品类型<select name="type" defaultValue={x.type}><option value="membership">会员充值</option><option value="account">账号产品</option><option value="physical">实物产品</option><option value="service">服务</option><option value="other">其他</option></select></label>
            <label>分类<input name="category" defaultValue={x.category??""}/></label>
            <label>默认售价（元）<input name="price" type="number" min="0" step="0.01" defaultValue={String((x.defaultPriceCents??0)/100)}/></label>
            <label>默认成本（元）<input name="cost" type="number" min="0" step="0.01" defaultValue={String((x.defaultCostCents??0)/100)}/></label>
            <label>安全库存<input name="safetyStock" type="number" min="0" step="1" defaultValue={x.safetyStock}/></label>
            <button>保存修改</button>
          </form>
          <form action={archiveProduct} className="inline-delete"><input type="hidden" name="id" value={x.id}/><input type="hidden" name="enabled" value={x.enabled?"0":"1"}/><button type="submit">{x.enabled?"归档":"恢复"}</button></form>
          <form action={deleteProduct} className="inline-delete"><input type="hidden" name="id" value={x.id}/><ConfirmSubmitButton label="删除" confirmText={`确认删除商品「${x.name}」？`}/></form>
        </details></td></tr>)}
      </tbody></table></div>:<Empty title="还没有商品" description="先建立商品，再进行库存入库和业务关联"/>}
    </section>
  </div>;
}
