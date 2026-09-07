import {and,desc,eq} from "drizzle-orm";
import type {PostgresJsDatabase} from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";
import {businessRecords,customers,financeTransactions} from "@/db/schema";

export type Db=PostgresJsDatabase<typeof schema>;
export type Tx=Parameters<Parameters<Db["transaction"]>[0]>[0];

export async function syncCustomerLastBusiness(tx:Tx,workspaceId:string,customerId:string|null){
  if(!customerId)return;
  const [latest]=await tx.select({occurredAt:businessRecords.occurredAt}).from(businessRecords).where(and(eq(businessRecords.workspaceId,workspaceId),eq(businessRecords.customerId,customerId))).orderBy(desc(businessRecords.occurredAt)).limit(1);
  await tx.update(customers).set({lastBusinessAt:latest?.occurredAt??null,updatedAt:new Date()}).where(and(eq(customers.id,customerId),eq(customers.workspaceId,workspaceId)));
}

export async function syncBusinessFinance(tx:Tx,workspaceId:string,businessId:string,revenue:number,content:string,occurredAt:Date){
  const linked=await tx.select().from(financeTransactions).where(and(eq(financeTransactions.workspaceId,workspaceId),eq(financeTransactions.businessId,businessId),eq(financeTransactions.type,"customer_receipt")));
  if(revenue>0){
    if(linked[0])await tx.update(financeTransactions).set({amountCents:revenue,notes:content,occurredAt}).where(eq(financeTransactions.id,linked[0].id));
    else await tx.insert(financeTransactions).values({workspaceId,businessId,type:"customer_receipt",occurredAt,amountCents:revenue,notes:content});
  }else if(linked[0])await tx.delete(financeTransactions).where(eq(financeTransactions.id,linked[0].id));
}
