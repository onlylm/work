import {and,desc,eq,sql} from "drizzle-orm";
import {getDb} from "@/db";
import {inventoryItems,products,stockMovements} from "@/db/schema";
import {decryptPayload,encryptPayload,payloadHash} from "@/lib/inventory-crypto";

export type DbTx=Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

export async function assertInventoryProduct(workspaceId:string,productId:string){
  const [row]=await getDb().select({id:products.id,type:products.type}).from(products).where(and(eq(products.id,productId),eq(products.workspaceId,workspaceId))).limit(1);
  if(!row)throw new Error("商品不存在或不属于当前工作空间");
  return row;
}

export async function countInventory(workspaceId:string,productId:string,status="available"){
  const db=getDb();
  const [row]=await db.select({total:sql<number>`count(*)::int`}).from(inventoryItems).where(and(eq(inventoryItems.workspaceId,workspaceId),eq(inventoryItems.productId,productId),eq(inventoryItems.status,status)));
  return Number(row?.total??0);
}

export async function importInventoryLines(workspaceId:string,productId:string,lines:string[]){
  const product=await assertInventoryProduct(workspaceId,productId);
  if(product.type!=="account")throw new Error("仅账号/卡密类商品可导入加密库存");
  const db=getDb();
  let inserted=0;
  let skipped=0;
  for(const raw of lines){
    const plain=raw.trim();
    if(!plain)continue;
    const hash=payloadHash(workspaceId,productId,plain);
    try{
      await db.insert(inventoryItems).values({workspaceId,productId,encryptedPayload:encryptPayload(plain),payloadHash:hash,status:"available"});
      inserted++;
    }catch(e){
      if(String(e).includes("inventory_payload_uq")||String(e).includes("duplicate"))skipped++;
      else throw e;
    }
  }
  return {inserted,skipped};
}

export async function claimInventoryItem(workspaceId:string,productId:string,businessId:string){
  const product=await assertInventoryProduct(workspaceId,productId);
  if(product.type!=="account")throw new Error("该商品不是账号/卡密类型");
  const db=getDb();
  return db.transaction(async tx=>{
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${workspaceId}:${productId}`}))`);
    const picked=await tx.execute<{id:number}>(sql`
      select id from inventory_items
      where workspace_id = ${workspaceId} and product_id = ${productId} and status = 'available'
      order by id
      for update skip locked
      limit 1
    `);
    const itemId=Number(picked[0]?.id);
    if(!itemId)throw new Error("没有可用库存，请先导入");
    await tx.update(inventoryItems).set({status:"delivered",businessId,deliveredAt:new Date()}).where(and(eq(inventoryItems.id,itemId),eq(inventoryItems.workspaceId,workspaceId)));
    return itemId;
  });
}

export async function revealInventoryOnce(workspaceId:string,itemId:number,userId:string){
  const db=getDb();
  const [row]=await db.select().from(inventoryItems).where(and(eq(inventoryItems.id,itemId),eq(inventoryItems.workspaceId,workspaceId))).limit(1);
  if(!row)throw new Error("库存记录不存在");
  if(row.status!=="delivered")throw new Error("该库存尚未领取或不可用");
  if(row.revealedAt)throw new Error("该库存内容已查看，不可再次展示");
  const plain=decryptPayload(row.encryptedPayload);
  await db.update(inventoryItems).set({revealedAt:new Date()}).where(eq(inventoryItems.id,itemId));
  return {plain,itemId,businessId:row.businessId};
}

export async function applyStockMovement(workspaceId:string,productId:string,type:"in"|"out"|"adjust",quantity:number,notes?:string,businessId?:string|null){
  if(!Number.isInteger(quantity)||quantity<=0)throw new Error("数量必须是正整数");
  const product=await assertInventoryProduct(workspaceId,productId);
  if(product.type!=="physical")throw new Error("仅实物商品可记录库存流水");
  const db=getDb();
  return db.transaction(async tx=>{
    const [current]=await tx.select({stockQuantity:products.stockQuantity}).from(products).where(and(eq(products.id,productId),eq(products.workspaceId,workspaceId))).for("update");
    if(!current)throw new Error("商品不存在");
    let delta=quantity;
    if(type==="out")delta=-quantity;
    if(type==="adjust")delta=quantity-current.stockQuantity;
    const balance=current.stockQuantity+delta;
    if(balance<0)throw new Error("库存不足，无法出库");
    await tx.update(products).set({stockQuantity:balance,updatedAt:new Date()}).where(and(eq(products.id,productId),eq(products.workspaceId,workspaceId)));
    await tx.insert(stockMovements).values({workspaceId,productId,type,quantity:Math.abs(delta)||quantity,balanceAfter:balance,notes:notes??null,businessId:businessId??null});
    return balance;
  });
}

export async function listStockMovements(workspaceId:string,productId:string,limit=20){
  return getDb().select().from(stockMovements).where(and(eq(stockMovements.workspaceId,workspaceId),eq(stockMovements.productId,productId))).orderBy(desc(stockMovements.id)).limit(limit);
}
