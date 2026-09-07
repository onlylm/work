type ToolbarProps={action:string;search?:string;from?:string;to?:string;page?:number;totalPages?:number;placeholder?:string;showDate?:boolean};

export function ListToolbar({action,search,from,to,page=1,totalPages=1,placeholder="搜索",showDate=false}:ToolbarProps){
  return <form action={action} method="get" className="list-toolbar">
    <input name="q" defaultValue={search??""} placeholder={placeholder}/>
    {showDate&&<>
      <input name="from" type="date" defaultValue={from??""} aria-label="开始日期"/>
      <input name="to" type="date" defaultValue={to??""} aria-label="结束日期"/>
    </>}
    <button type="submit">筛选</button>
    {totalPages>1&&<div className="pager">
      {page>1&&<a href={`${action}?${new URLSearchParams({...(search?{q:search}:{}),...(from?{from}:{}),...(to?{to}:{}),page:String(page-1)}).toString()}`}>上一页</a>}
      <span>{page} / {totalPages}</span>
      {page<totalPages&&<a href={`${action}?${new URLSearchParams({...(search?{q:search}:{}),...(from?{from}:{}),...(to?{to}:{}),page:String(page+1)}).toString()}`}>下一页</a>}
    </div>}
  </form>;
}
