"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useState} from "react";
import {BookOpen,Boxes,BriefcaseBusiness,CalendarCheck,CreditCard,FileChartColumn,Globe2,LayoutDashboard,LogOut,Menu,PackageCheck,Settings,Sparkles,Users,WalletCards,X} from "lucide-react";
import {logoutAction} from "@/app/login/actions";

type NavItem={href:string;label:string;icon:typeof LayoutDashboard;disabled?:boolean;badge?:string};
type NavGroup={title:string;items:NavItem[]};

const groups:NavGroup[]=[
  {title:"日常经营",items:[
    {href:"/dashboard",label:"工作台",icon:LayoutDashboard},
    {href:"/quick-entry",label:"快速记录",icon:Sparkles},
    {href:"/customers",label:"客户",icon:Users},
    {href:"/business",label:"业务流水",icon:BriefcaseBusiness},
    {href:"/finance",label:"资金流水",icon:WalletCards},
    {href:"/tasks",label:"待办提醒",icon:CalendarCheck},
  ]},
  {title:"商品与交付",items:[
    {href:"/memberships",label:"会员管理",icon:CreditCard},
    {href:"/products",label:"商品库存",icon:Boxes},
    {href:"/deliveries",label:"账号交付",icon:PackageCheck,disabled:true,badge:"未启用"},
  ]},
  {title:"分析与设置",items:[
    {href:"/reports",label:"经营报表",icon:FileChartColumn},
    {href:"/websites",label:"常用网站",icon:Globe2},
    {href:"/settings",label:"系统设置",icon:Settings},
  ]},
];

const titles=Object.fromEntries(groups.flatMap(g=>g.items.map(i=>[i.href,i.label])));

export function AppShell({children,user}:{children:React.ReactNode;user:{name:string;email:string}}){
  const path=usePathname();
  const [open,setOpen]=useState(false);
  const title=titles[path]??(path.startsWith("/customers/")?"客户详情":path.startsWith("/business/")?"业务详情":path.startsWith("/memberships/")?"会员详情":path.startsWith("/products/")?"商品详情":"经营工作台");
  return <div className="app">
    <aside className={open?"app-side open":"app-side"}>
      <div className="app-brand">
        <span><BookOpen/></span>
        <div><b>经营工作台</b><small>个人经营管理</small></div>
        <button onClick={()=>setOpen(false)} aria-label="关闭菜单"><X/></button>
      </div>
      <nav>
        {groups.map(group=><div key={group.title} className="nav-group">
          <p className="nav-group-title">{group.title}</p>
          {group.items.map(item=>{
            const Icon=item.icon;
            if(item.disabled){
              return <span key={item.href} className="nav-disabled" title="功能尚未开放"><Icon/><span>{item.label}</span>{item.badge&&<em>{item.badge}</em>}</span>;
            }
            const active=path===item.href||path.startsWith(`${item.href}/`);
            return <Link href={item.href} key={item.href} className={active?"active":""} onClick={()=>setOpen(false)}><Icon/><span>{item.label}</span></Link>;
          })}
        </div>)}
      </nav>
      <div className="account">
        <span>{user.name.slice(0,1)}</span>
        <div><b>{user.name}</b><small>{user.email}</small></div>
        <form action={logoutAction}><button title="退出登录"><LogOut/></button></form>
      </div>
    </aside>
    {open&&<button className="side-mask" onClick={()=>setOpen(false)} aria-label="关闭菜单"/>}
    <main className="app-main">
      <header className="topbar">
        <button className="menu-button" onClick={()=>setOpen(true)} aria-label="打开菜单"><Menu/></button>
        <h1>{title}</h1>
        <div><span className="secure-dot"/>安全会话</div>
      </header>
      {children}
    </main>
  </div>;
}
