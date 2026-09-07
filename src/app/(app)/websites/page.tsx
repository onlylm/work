import {desc,eq} from "drizzle-orm";
import {ExternalLink} from "lucide-react";
import {getDb} from "@/db";
import {websites} from "@/db/schema";
import {requireSession} from "@/lib/auth";
import {ConfirmSubmitButton} from "@/components/delete-button";
import {FlashBanner} from "@/components/flash-banner";
import {ListToolbar} from "@/components/list-toolbar";
import {Empty,PageHeader} from "@/components/ui";
import {listOffset} from "@/lib/list-query";
import {createWebsite,deleteWebsite,updateWebsite} from "../actions";
import {and,ilike,or,count} from "drizzle-orm";

export const dynamic="force-dynamic";
const PAGE_SIZE=24;

function websiteFilter(workspaceId:string,q?:string){
  const base=eq(websites.workspaceId,workspaceId);
  if(!q?.trim())return base;
  const term=`%${q.trim()}%`;
  return and(base,or(ilike(websites.name,term),ilike(websites.notes,term)))!;
}

export default async function WebsitesPage({searchParams}:{searchParams:Promise<{q?:string;page?:string;success?:string;error?:string}>}){
  const {q,page:pageRaw,success,error}=await searchParams;
  const s=await requireSession();
  const where=websiteFilter(s.workspaceId,q);
  const {page,offset,pageSize}=listOffset(pageRaw,PAGE_SIZE);
  const db=getDb();
  const [countRow]=await db.select({total:count()}).from(websites).where(where);
  const total=Number(countRow?.total??0);
  const totalPages=Math.max(1,Math.ceil(total/pageSize));
  const rows=await db.select().from(websites).where(where).orderBy(desc(websites.createdAt)).limit(pageSize).offset(offset);
  return <div className="page">
    <PageHeader title="常用网站" description="只保存网站入口，不保存第三方网站密码"/>
    <FlashBanner success={success} error={error}/>
    <details className="form-disclosure"><summary>＋ 添加网站</summary>
      <form action={createWebsite} className="data-form">
        <label>网站名称<input name="name" required/></label>
        <label>网站地址<input name="url" type="url" placeholder="https://" required/></label>
        <label>归属类型<select name="kind"><option value="self">自建网站</option><option value="third_party">第三方网站</option></select></label>
        <label className="wide">用途说明<input name="notes"/></label>
        <button>保存网站</button>
      </form>
    </details>
    <section className="content-card list-card">
      <ListToolbar action="/websites" search={q} page={page} totalPages={totalPages} placeholder="搜索网站名称或说明"/>
      {rows.length?<div className="website-grid">{rows.map(x=><article key={x.id} className="website-card">
        <a href={x.url} target="_blank" rel="noreferrer"><span>{x.name.slice(0,1)}</span><div><b>{x.name}</b><small>{x.kind==="self"?"自建网站":"第三方网站"}{x.notes?` · ${x.notes}`:""}</small></div><ExternalLink/></a>
        <details><summary>编辑</summary>
          <form action={updateWebsite} className="data-form inline-form">
            <input type="hidden" name="id" value={x.id}/>
            <label>网站名称<input name="name" required defaultValue={x.name}/></label>
            <label>网站地址<input name="url" type="url" defaultValue={x.url} required/></label>
            <label>归属类型<select name="kind" defaultValue={x.kind}><option value="self">自建网站</option><option value="third_party">第三方网站</option></select></label>
            <label className="wide">用途说明<input name="notes" defaultValue={x.notes??""}/></label>
            <button>保存修改</button>
          </form>
          <form action={deleteWebsite} className="inline-delete"><input type="hidden" name="id" value={x.id}/><ConfirmSubmitButton label="删除" confirmText={`确认删除网站「${x.name}」？`}/></form>
        </details>
      </article>)}</div>:<Empty title="还没有常用网站" description="添加后可从这里快速、安全地打开"/>}
    </section>
  </div>;
}
