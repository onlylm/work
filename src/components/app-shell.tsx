"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useState} from "react";
import {BookOpen,Boxes,BriefcaseBusiness,CalendarCheck,CreditCard,FileChartColumn,Globe2,LayoutDashboard,LogOut,Menu,PackageCheck,Settings,Sparkles,Users,WalletCards,X} from "lucide-react";
import {logoutAction} from "@/app/login/actions";

const items=[
  ["/dashboard","工作台",LayoutDashboard],["/quick-entry","快速记录",Sparkles],["/customers","客户",Users],["/business","业务流水",BriefcaseBusiness],
  ["/memberships","会员充值",CreditCard],["/products","商品库存",Boxes],["/deliveries","账号交付",PackageCheck],
  ["/finance","资金流水",WalletCards],["/reports","经营报表",FileChartColumn],["/tasks","待办提醒",CalendarCheck],
  ["/websites","常用网站",Globe2],["/settings","系统设置",Settings],
] as const;
const names=Object.fromEntries(items.map(([url,name])=>[url,name]));

export function AppShell({children,user}:{children:React.ReactNode;user:{name:string;email:string}}){
  const path=usePathname();const[open,setOpen]=useState(false);const title=names[path]??"经营工作台";
  return <div className="app"><aside className={open?"app-side open":"app-side"}><div className="app-brand"><span><BookOpen/></span><div><b>经营工作台</b><small>个人经营管理</small></div><button onClick={()=>setOpen(false)} aria-label="关闭菜单"><X/></button></div><nav>{items.map(([url,name,Icon])=><Link href={url} key={url} className={path===url?"active":""} onClick={()=>setOpen(false)}><Icon/><span>{name}</span></Link>)}</nav><div className="account"><span>{user.name.slice(0,1)}</span><div><b>{user.name}</b><small>{user.email}</small></div><form action={logoutAction}><button title="退出登录"><LogOut/></button></form></div></aside>{open&&<button className="side-mask" onClick={()=>setOpen(false)} aria-label="关闭菜单"/>}<main className="app-main"><header className="topbar"><button className="menu-button" onClick={()=>setOpen(true)} aria-label="打开菜单"><Menu/></button><h1>{title}</h1><div><span className="secure-dot"/>安全会话</div></header>{children}</main></div>
}
