import {redirect} from "next/navigation";
import {BookOpen,LockKeyhole} from "lucide-react";
import {getSession} from "@/lib/auth";
import {ensureAdmin} from "@/lib/bootstrap";
import {loginAction} from "./actions";

export const dynamic="force-dynamic";
export default async function Login({searchParams}:{searchParams:Promise<{error?:string}>}){
  if(await getSession())redirect("/dashboard");
  let setupError="";try{await ensureAdmin()}catch(e){console.error("管理员初始化失败",e);setupError="数据库尚未准备好，请联系管理员检查部署日志"}
  const {error}=await searchParams;
  return <main className="login-page"><section className="login-card"><div className="login-brand"><span><BookOpen/></span><div><h1>个人经营工作台</h1><p>安全管理客户、业务、资金与待办</p></div></div><div className="login-title"><LockKeyhole/><h2>管理员登录</h2><p>请输入服务器部署时生成的管理员账号</p></div>{(error||setupError)&&<div className="form-error">{error||setupError}</div>}<form action={loginAction} className="login-form"><label>邮箱地址<input name="email" type="email" defaultValue={process.env.ADMIN_EMAIL??"admin@bugan.cn"} autoComplete="username" required/></label><label>密码<input name="password" type="password" autoComplete="current-password" minLength={8} required/></label><button type="submit">登录工作台</button></form><footer>登录会话采用加密 HttpOnly Cookie，有效期 7 天</footer></section></main>
}
