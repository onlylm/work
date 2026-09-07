import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {cookies} from "next/headers";
import {and,eq} from "drizzle-orm";
import {getDb} from "@/db";
import {businessRecords,inventoryItems,products} from "@/db/schema";
import {requireSession} from "@/lib/auth";
import {datetime} from "@/lib/format";
import {PageHeader} from "@/components/ui";
import {confirmReveal} from "../../../../inventory-actions";

export const dynamic="force-dynamic";

export default async function RevealInventoryPage({params}:{params:Promise<{id:string;itemId:string}>}){
  const {id:businessId,itemId:itemIdRaw}=await params;
  const itemId=Number(itemIdRaw);
  if(!Number.isFinite(itemId)||itemId<=0)notFound();
  const s=await requireSession();
  const db=getDb();
  const [biz]=await db.select().from(businessRecords).where(and(eq(businessRecords.id,businessId),eq(businessRecords.workspaceId,s.workspaceId))).limit(1);
  if(!biz)notFound();
  const [item]=await db.select().from(inventoryItems).where(and(eq(inventoryItems.id,itemId),eq(inventoryItems.workspaceId,s.workspaceId),eq(inventoryItems.businessId,businessId))).limit(1);
  if(!item)notFound();
  const productRow=item.productId?await db.select({name:products.name}).from(products).where(eq(products.id,item.productId)).limit(1):[];
  const productName=productRow[0]?.name??"商品";
  const jar=await cookies();
  const flashKey=`inv_reveal_${itemId}`;
  const flash=jar.get(flashKey)?.value;
  if(flash){
    jar.delete(flashKey);
    return <div className="page">
      <PageHeader title="敏感内容（仅此一次）" description={`${productName} · 业务 ${biz.content}`}/>
      <p className="detail-back"><Link href={`/business/${businessId}`}>← 返回业务详情</Link></p>
      <section className="content-card reveal-card">
        <p className="reveal-warning">以下内容仅展示一次，关闭页面后不可再次查看。请通过安全渠道发送给客户。</p>
        <pre className="reveal-payload">{flash}</pre>
      </section>
    </div>;
  }
  if(item.revealedAt){
    return <div className="page">
      <PageHeader title="内容已查看" description={`该库存已在 ${datetime(item.revealedAt)} 查看过`}/>
      <p className="detail-back"><Link href={`/business/${businessId}`}>← 返回业务详情</Link></p>
      <section className="content-card"><p className="muted">出于安全考虑，敏感内容不可再次展示。如需补发，请核对业务记录后人工处理。</p></section>
    </div>;
  }
  if(item.status!=="delivered")redirect(`/business/${businessId}`);
  return <div className="page">
    <PageHeader title="确认查看敏感内容" description="此操作不可撤销，内容只展示一次"/>
    <p className="detail-back"><Link href={`/business/${businessId}`}>← 返回业务详情</Link></p>
    <section className="content-card">
      <p>即将查看与业务「{biz.content}」关联的 {productName} 库存内容。</p>
      <form action={confirmReveal} className="data-form one" style={{marginTop:16}}>
        <input type="hidden" name="businessId" value={businessId}/>
        <input type="hidden" name="itemId" value={itemId}/>
        <button className="main-button">确认查看（仅一次）</button>
      </form>
    </section>
  </div>;
}
