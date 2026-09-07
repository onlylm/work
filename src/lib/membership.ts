import {and,eq,gt,isNull,like,lte} from "drizzle-orm";
import {getDb} from "@/db";
import {customers,membershipSubscriptions,tasks} from "@/db/schema";

export const REMINDER_DAYS=[7,3,1] as const;

export function daysUntil(date:Date){
  const now=new Date();
  now.setHours(0,0,0,0);
  const target=new Date(date);
  target.setHours(0,0,0,0);
  return Math.round((target.getTime()-now.getTime())/86400000);
}

export function reminderKey(subscriptionId:string,days:number){
  return `[mid:${subscriptionId}:d${days}]`;
}

export function reminderTitle(subscriptionId:string,days:number,customerName:string,platform:string,planName:string){
  return `${reminderKey(subscriptionId,days)} ${customerName} · ${platform} · ${planName} · 还有${days}天到期`;
}

export async function refreshMembershipStatuses(workspaceId:string){
  const db=getDb();
  const now=new Date();
  await db.update(membershipSubscriptions).set({status:"expired",updatedAt:now}).where(and(eq(membershipSubscriptions.workspaceId,workspaceId),eq(membershipSubscriptions.status,"active"),lte(membershipSubscriptions.expiresAt,now)));
}

export async function syncMembershipReminderTasks(workspaceId:string){
  await refreshMembershipStatuses(workspaceId);
  const db=getDb();
  const now=new Date();
  const rows=await db.select({
    id:membershipSubscriptions.id,
    platform:membershipSubscriptions.platform,
    planName:membershipSubscriptions.planName,
    expiresAt:membershipSubscriptions.expiresAt,
    customerName:customers.name,
  }).from(membershipSubscriptions).innerJoin(customers,and(eq(customers.id,membershipSubscriptions.customerId),eq(customers.workspaceId,workspaceId))).where(and(eq(membershipSubscriptions.workspaceId,workspaceId),eq(membershipSubscriptions.status,"active"),gt(membershipSubscriptions.expiresAt,now)));

  for(const row of rows){
    const left=daysUntil(row.expiresAt);
    if(!REMINDER_DAYS.includes(left as typeof REMINDER_DAYS[number]))continue;
    const prefix=reminderKey(row.id,left);
    const [existing]=await db.select({id:tasks.id}).from(tasks).where(and(eq(tasks.workspaceId,workspaceId),eq(tasks.type,"membership_reminder"),like(tasks.title,`${prefix}%`),isNull(tasks.completedAt))).limit(1);
    if(existing)continue;
    await db.insert(tasks).values({
      workspaceId,
      type:"membership_reminder",
      title:reminderTitle(row.id,left,row.customerName,row.platform,row.planName),
      dueAt:row.expiresAt,
    });
  }
}

export async function listExpiringMemberships(workspaceId:string,withinDays=30){
  await syncMembershipReminderTasks(workspaceId);
  const db=getDb();
  const until=new Date();
  until.setDate(until.getDate()+withinDays);
  until.setHours(23,59,59,999);
  return db.select({
    id:membershipSubscriptions.id,
    platform:membershipSubscriptions.platform,
    planName:membershipSubscriptions.planName,
    expiresAt:membershipSubscriptions.expiresAt,
    customerId:membershipSubscriptions.customerId,
    customerName:customers.name,
  }).from(membershipSubscriptions).innerJoin(customers,and(eq(customers.id,membershipSubscriptions.customerId),eq(customers.workspaceId,workspaceId))).where(and(eq(membershipSubscriptions.workspaceId,workspaceId),eq(membershipSubscriptions.status,"active"),lte(membershipSubscriptions.expiresAt,until),gt(membershipSubscriptions.expiresAt,new Date()))).orderBy(membershipSubscriptions.expiresAt);
}
