import Link from "next/link";
import {notFound} from "next/navigation";
import {and,eq} from "drizzle-orm";
import {getDb} from "@/db";
import {inventoryItems,products} from "@/db/schema";
import {requireSession} from "@/lib/auth";
import {businessTypeName,cny,datetime} from "@/lib/format";
import {countInventory,listStockMovements} from "@/lib/inventory";
import {ConfirmSubmitButton} from "@/components/delete-button";
import {FlashBanner} from "@/components/flash-banner";
import {PageHeader} from "@/components/ui";
import {deleteInventoryItem,importInventory,recordStockMovement} from "../../inventory-actions";
import {archiveProduct,updateProduct} from "../../actions";

export const dynamic="force-dynamic";

const stockTypeName:Record<string,string>={in:"入库",out:"出库",adjust:"盘点调整"};

export default async function ProductDetailPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{success?:string;error?:string}>}){
  const {id}=await params;
  const {success,error}=await searchParams;
  const s=await requireSession();
  const db=getDb();
  const [product]=await db.select().from(products).where(and(eq(products.id,id),eq(products.workspaceId,s.workspaceId))).limit(1);
  if(!product)notFound();
  const isAccount=product.type==="account";
  const isPhysical=product.type==="physical";
  const [available,delivered,items,movements]=await Promise.all([
    isAccount?countInventory(s.workspaceId,id,"available"):Promise.resolve(0),
    isAccount?countInventory(s.workspaceId,id,"delivered"):Promise.resolve(0),
    isAccount?db.select({id:inventoryItems.id,status:inventoryItems.status,createdAt:inventoryItems.createdAt,businessId:inventoryItems.businessId,revealedAt:inventoryItems.revealedAt}).from(inventoryItems).where(and(eq(inventoryItems.workspaceId,s.workspaceId),eq(inventoryItems.productId,id))).orderBy(inventoryItems.id).limit(30):Promise.resolve([]),
    isPhysical?listStockMovements(s.workspaceId,id,20):Promise.resolve([]),
  ]);
  const lowStock=isPhysical&&product.stockQuantity<product.safetyStock;
  return <div className="page">
    <PageHeader title={product.name} description={`${businessTypeName[product.type]}${product.category?` · ${product.category}`:""}`}/>
    <FlashBanner success={success} error={error}/>
    <p className="detail-back"><Link href="/products">← 返回商品列表</Link></p>
    <div className="detail-grid">
      <section className="content-card">
        <header><div><h3>商品资料</h3><p>{product.enabled?"启用中":"已归档"}</p></div></header>
        <dl className="detail-dl">
          <div><dt>默认售价</dt><dd>{cny(product.defaultPriceCents)}</dd></div>
          <div><dt>默认成本</dt><dd>{cny(product.defaultCostCents)}</dd></div>
          {isPhysical&&<div><dt>当前库存</dt><dd className={lowStock?"text-danger":""}>{product.stockQuantity} 件</dd></div>}
          {isPhysical&&<div><dt>安全库存</dt><dd>{product.safetyStock} 件</dd></div>}
          {isAccount&&<div><dt>可用卡密</dt><dd>{available} 条</dd></div>}
          {isAccount&&<div><dt>已交付</dt><dd>{delivered} 条</dd></div>}
        </dl>
        <details className="form-disclosure"><summary>编辑商品</summary>
          <form action={updateProduct} className="data-form inline-form">
            <input type="hidden" name="id" value={product.id}/>
            <label>商品名称<input name="name" required defaultValue={product.name}/></label>
            <label>商品类型<select name="type" defaultValue={product.type}><option value="membership">会员充值</option><option value="account">账号产品</option><option value="physical">实物产品</option><option value="service">服务</option><option value="other">其他</option></select></label>
            <label>分类<input name="category" defaultValue={product.category??""}/></label>
            <label>默认售价（元）<input name="price" type="number" min="0" step="0.01" defaultValue={String((product.defaultPriceCents??0)/100)}/></label>
            <label>默认成本（元）<input name="cost" type="number" min="0" step="0.01" defaultValue={String((product.defaultCostCents??0)/100)}/></label>
            <label>安全库存<input name="safetyStock" type="number" min="0" step="1" defaultValue={product.safetyStock}/></label>
            <button>保存修改</button>
          </form>
          <form action={archiveProduct} className="inline-delete"><input type="hidden" name="id" value={product.id}/><input type="hidden" name="enabled" value={product.enabled?"0":"1"}/><button type="submit">{product.enabled?"归档":"恢复"}</button></form>
        </details>
      </section>
      <section className="content-card">
        <header><div><h3>{isAccount?"加密库存":isPhysical?"库存流水":"库存管理"}</h3><p>{isAccount?"内容加密存储，领取后仅可查看一次":isPhysical?"入库、出库与盘点调整": "此类型商品无需库存"}</p></div></header>
        {isAccount&&<>
          <Callout note="敏感内容仅在业务领取后一次性展示，请勿在聊天中转发。"/>
          <details className="form-disclosure"><summary>＋ 导入卡密/账号（每行一条）</summary>
            <form action={importInventory} className="data-form one">
              <input type="hidden" name="productId" value={product.id}/>
              <label className="wide">库存内容<textarea name="lines" required rows={8} placeholder="每行一条账号或卡密，导入后加密保存"/></label>
              <button>加密导入</button>
            </form>
          </details>
          {items.length?<div className="data-table"><table><thead><tr><th>ID</th><th>状态</th><th>导入时间</th><th>操作</th></tr></thead><tbody>
            {items.map(x=><tr key={x.id}><td>{x.id}</td><td>{x.status==="available"?"可用":x.revealedAt?"已查看":"已交付"}</td><td>{datetime(x.createdAt)}</td><td className="row-actions">
              {x.status==="available"&&<form action={deleteInventoryItem} className="inline-delete"><input type="hidden" name="productId" value={product.id}/><input type="hidden" name="itemId" value={x.id}/><ConfirmSubmitButton label="删除" confirmText="确认删除这条未领取库存？"/></form>}
              {x.businessId&&<Link href={`/business/${x.businessId}`}>关联业务</Link>}
            </td></tr>)}
          </tbody></table></div>:<p className="muted">还没有导入库存</p>}
        </>}
        {isPhysical&&<>
          <div className="two-forms">
            <form action={recordStockMovement} className="data-form one"><input type="hidden" name="productId" value={product.id}/><input type="hidden" name="type" value="in"/><label>入库数量<input name="quantity" type="number" min="1" step="1" required/></label><label>说明<input name="notes"/></label><button>确认入库</button></form>
            <form action={recordStockMovement} className="data-form one"><input type="hidden" name="productId" value={product.id}/><input type="hidden" name="type" value="out"/><label>出库数量<input name="quantity" type="number" min="1" step="1" required/></label><label>说明<input name="notes"/></label><button>确认出库</button></form>
          </div>
          <form action={recordStockMovement} className="data-form one" style={{marginTop:12}}><input type="hidden" name="productId" value={product.id}/><input type="hidden" name="type" value="adjust"/><label>盘点后实际数量<input name="quantity" type="number" min="0" step="1" defaultValue={product.stockQuantity} required/></label><label>说明<input name="notes" placeholder="例如：月度盘点"/></label><button>保存盘点</button></form>
          {movements.length?<div className="simple-list" style={{marginTop:16}}>{movements.map(x=><div key={x.id}><div><b>{stockTypeName[x.type]??x.type}</b><small>{datetime(x.createdAt)}{x.notes?` · ${x.notes}`:""}</small></div><strong>{x.balanceAfter} 件</strong></div>)}</div>:<p className="muted">暂无库存流水</p>}
        </>}
        {!isAccount&&!isPhysical&&<p className="muted">会员、服务等商品类型不需要库存模块。</p>}
      </section>
    </div>
  </div>;
}

function Callout({note}:{note:string}){
  return <div className="flash flash-error" style={{marginBottom:12}}>{note}</div>;
}
