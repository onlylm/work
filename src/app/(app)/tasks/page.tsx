import {asc,eq} from "drizzle-orm";
import {CheckCircle2,Circle} from "lucide-react";
import {getDb} from "@/db";
import {tasks} from "@/db/schema";
import {requireSession} from "@/lib/auth";
import {datetime} from "@/lib/format";
import {FlashBanner} from "@/components/flash-banner";
import {Empty,PageHeader} from "@/components/ui";
import {createTask,toggleTask} from "../actions";

export const dynamic="force-dynamic";

export default async function Tasks({searchParams}:{searchParams:Promise<{success?:string;error?:string}>}){
  const {success,error}=await searchParams;
  const s=await requireSession();
  const rows=await getDb().select().from(tasks).where(eq(tasks.workspaceId,s.workspaceId)).orderBy(asc(tasks.completedAt),asc(tasks.dueAt));
  return <div className="page">
    <PageHeader title="待办提醒" description="集中处理手工待办和后续自动生成的业务提醒"/>
    <FlashBanner success={success} error={error}/>
    <details className="form-disclosure"><summary>＋ 新增待办</summary>
      <form action={createTask} className="data-form">
        <label className="wide">待办内容<input name="title" required maxLength={200}/></label>
        <label>截止时间<input name="dueAt" type="datetime-local"/></label>
        <button>保存待办</button>
      </form>
    </details>
    <section className="content-card list-card">
      {rows.length?<div className="tasks-page-list">{rows.map(x=><div key={x.id} className={x.completedAt?"done":""}>
        <form action={toggleTask}>
          <input type="hidden" name="id" value={x.id}/>
          <input type="hidden" name="done" value={x.completedAt?"1":"0"}/>
          <button aria-label={x.completedAt?"重新打开":"标记完成"}>{x.completedAt?<CheckCircle2/>:<Circle/>}</button>
        </form>
        <div><b>{x.title}</b><small>{x.completedAt?`完成于 ${datetime(x.completedAt)}`:x.dueAt?`截止 ${datetime(x.dueAt)}`:"未设置截止时间"}</small></div>
      </div>)}</div>:<Empty title="没有待办事项" description="新增待办后会显示在工作台首页"/>}
    </section>
  </div>;
}
