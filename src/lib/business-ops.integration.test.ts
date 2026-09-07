import {and,eq} from "drizzle-orm";
import {drizzle} from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {afterAll,beforeAll,describe,expect,it} from "vitest";
import * as schema from "@/db/schema";
import {auditLogs,businessRecords,customers,financeTransactions,products,workspaces} from "@/db/schema";
import {syncBusinessFinance,syncCustomerLastBusiness} from "@/lib/business-ops";
import {profit} from "@/lib/finance";

const url=process.env.TEST_DATABASE_URL||process.env.DATABASE_URL;
const run=Boolean(url);

describe.skipIf(!run)("业务写入集成",()=>{
  const sql=postgres(url!,{max:1,prepare:false});
  const db=drizzle(sql,{schema});
  let workspaceA="";
  let workspaceB="";
  let customerA="";
  let productA="";

  beforeAll(async()=>{
    const [a]=await db.insert(workspaces).values({name:`it-a-${Date.now()}`}).returning({id:workspaces.id});
    const [b]=await db.insert(workspaces).values({name:`it-b-${Date.now()}`}).returning({id:workspaces.id});
    workspaceA=a.id;
    workspaceB=b.id;
    const [c]=await db.insert(customers).values({workspaceId:workspaceA,name:"集成测试客户"}).returning({id:customers.id});
    customerA=c.id;
    const [p]=await db.insert(products).values({workspaceId:workspaceA,name:"集成测试商品",type:"service",defaultPriceCents:10000,defaultCostCents:3000}).returning({id:products.id});
    productA=p.id;
  });

  afterAll(async()=>{
    await db.delete(financeTransactions).where(eq(financeTransactions.workspaceId,workspaceA));
    await db.delete(businessRecords).where(eq(businessRecords.workspaceId,workspaceA));
    await db.delete(products).where(eq(products.workspaceId,workspaceA));
    await db.delete(customers).where(eq(customers.workspaceId,workspaceA));
    await db.delete(auditLogs).where(eq(auditLogs.workspaceId,workspaceA));
    await db.delete(workspaces).where(eq(workspaces.id,workspaceA));
    await db.delete(workspaces).where(eq(workspaces.id,workspaceB));
    await sql.end({timeout:5});
  });

  it("写入业务时同步收款流水、product_id 与 last_business_at",async()=>{
    const occurredAt=new Date("2026-09-01T10:00:00+08:00");
    const revenue=12800;
    const cost=3000;
    const [row]=await db.transaction(async tx=>{
      const inserted=await tx.insert(businessRecords).values({
        number:`IT${Date.now()}`,
        workspaceId:workspaceA,
        customerId:customerA,
        productId:productA,
        type:"service",
        content:"集成测试业务",
        status:"paid_pending",
        occurredAt,
        revenueCents:revenue,
        costCents:cost,
        directExpenseCents:0,
        profitCents:profit(revenue,cost,0),
      }).returning({id:businessRecords.id});
      await syncBusinessFinance(tx,workspaceA,inserted[0].id,revenue,"集成测试业务",occurredAt);
      await syncCustomerLastBusiness(tx,workspaceA,customerA);
      return inserted;
    });

    const [biz]=await db.select().from(businessRecords).where(eq(businessRecords.id,row.id));
    expect(biz.productId).toBe(productA);
    expect(biz.profitCents).toBe(9800);

    const finance=await db.select().from(financeTransactions).where(and(eq(financeTransactions.businessId,row.id),eq(financeTransactions.type,"customer_receipt")));
    expect(finance).toHaveLength(1);
    expect(finance[0].amountCents).toBe(revenue);
    expect(finance[0].workspaceId).toBe(workspaceA);

    const [customer]=await db.select().from(customers).where(eq(customers.id,customerA));
    expect(customer.lastBusinessAt?.toISOString()).toBe(occurredAt.toISOString());
  });

  it("跨工作空间客户不可见：B 空间查询不到 A 的客户",async()=>{
    const rows=await db.select().from(customers).where(and(eq(customers.workspaceId,workspaceB),eq(customers.id,customerA)));
    expect(rows).toHaveLength(0);
  });

  it("删除业务时级联删除收款流水并清空 last_business_at",async()=>{
    const [biz]=await db.select().from(businessRecords).where(and(eq(businessRecords.workspaceId,workspaceA),eq(businessRecords.customerId,customerA))).limit(1);
    expect(biz).toBeTruthy();
    await db.transaction(async tx=>{
      await tx.delete(financeTransactions).where(and(eq(financeTransactions.workspaceId,workspaceA),eq(financeTransactions.businessId,biz.id)));
      await tx.delete(businessRecords).where(and(eq(businessRecords.id,biz.id),eq(businessRecords.workspaceId,workspaceA)));
      await syncCustomerLastBusiness(tx,workspaceA,customerA);
    });
    const finance=await db.select().from(financeTransactions).where(eq(financeTransactions.businessId,biz.id));
    expect(finance).toHaveLength(0);
    const [customer]=await db.select().from(customers).where(eq(customers.id,customerA));
    expect(customer.lastBusinessAt).toBeNull();
  });
});
