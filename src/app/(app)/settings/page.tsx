import {Database,Download,KeyRound,Plug,RefreshCw,ShieldCheck,Upload} from "lucide-react";
import {requireSession} from "@/lib/auth";
import {listBackups} from "@/lib/backups";
import {listIntegrationStatus} from "@/lib/integrations";
import {FlashBanner} from "@/components/flash-banner";
import {PageHeader} from "@/components/ui";
import {changePassword,importCustomersCsv,revokeAllSessions,testIntegration} from "../settings-actions";

function formatBytes(size:number){
  if(size<1024)return `${size} B`;
  if(size<1024*1024)return `${(size/1024).toFixed(1)} KB`;
  return `${(size/(1024*1024)).toFixed(1)} MB`;
}

export const dynamic="force-dynamic";

export default async function SettingsPage({searchParams}:{searchParams:Promise<{success?:string;error?:string}>}){
  const {success,error}=await searchParams;
  const s=await requireSession();
  const integrations=listIntegrationStatus();
  const backups=await listBackups();
  return <div className="page">
    <PageHeader title="系统设置" description="账号安全、数据导入导出与集成状态"/>
    <FlashBanner success={success} error={error}/>
    <section className="settings-grid">
      <article><ShieldCheck/><div><h3>登录保护</h3><p>所有业务页面与服务端写操作均校验登录会话。</p></div></article>
      <article><Database/><div><h3>工作空间</h3><p>{s.workspaceId.slice(0,8)}…</p></div></article>
      <article><KeyRound/><div><h3>管理员</h3><p>{s.email}</p></div></article>
    </section>
    <div className="detail-grid">
      <section className="content-card">
        <header><div><h3>修改密码</h3><p>修改后会使其他设备会话失效</p></div></header>
        <form action={changePassword} className="data-form one">
          <label>当前密码<input name="currentPassword" type="password" required minLength={8} autoComplete="current-password"/></label>
          <label>新密码<input name="newPassword" type="password" required minLength={8} autoComplete="new-password"/></label>
          <label>确认新密码<input name="confirmPassword" type="password" required minLength={8} autoComplete="new-password"/></label>
          <button>保存新密码</button>
        </form>
        <form action={revokeAllSessions} className="data-form one" style={{marginTop:16}}>
          <label>验证密码以失效其他会话<input name="password" type="password" required minLength={8} autoComplete="current-password"/></label>
          <button type="submit">使其他设备下线</button>
        </form>
      </section>
      <section className="content-card">
        <header><div><h3>数据导出</h3><p>CSV 格式，UTF-8 带 BOM，可用 Excel 打开</p></div></header>
        <div className="export-links">
          {([["customers","客户"],["business","业务流水"],["finance","资金流水"],["products","商品"]] as const).map(([kind,label])=><a key={kind} href={`/api/export/${kind}`} className="export-link"><Download/>导出{label}</a>)}
        </div>
        <header style={{marginTop:24}}><div><h3>客户导入</h3><p>首行表头需含「姓名」列，可选手机、微信、备注</p></div></header>
        <form action={importCustomersCsv} className="data-form one">
          <label className="wide">CSV 内容<textarea name="csv" rows={8} placeholder={"姓名,手机,微信,备注\n张三,13800000000,wxid,老客户"} required/></label>
          <button><Upload/>导入客户</button>
        </form>
      </section>
    </div>
    <section className="content-card" style={{marginTop:16}}>
      <header><div><h3>外部集成</h3><p>接口密钥仅保存在服务端环境变量，不会下发到浏览器</p></div></header>
      <div className="integration-list">{integrations.map(x=><article key={x.name} className={x.configured?"":"muted-row"}>
        <Plug/><div><b>{x.label}</b><small>{x.configured?"已配置环境变量":"未配置"} · {x.hint}</small>
          {x.configured&&<form action={testIntegration} className="inline-form" style={{marginTop:8}}>
            <input type="hidden" name="name" value={x.name}/>
            <button type="submit" className="ghost-btn"><RefreshCw/>测试连通</button>
          </form>}
        </div>
      </article>)}</div>
    </section>
    <section className="content-card" style={{marginTop:16}}>
      <header><div><h3>数据库备份</h3><p>生产环境每日自动 pg_dump，保留 14 天。下载前请确认存储安全。</p></div></header>
      {backups.length===0
        ?<p className="muted-text">当前未检测到备份文件。本地开发无 BACKUP_DIR 挂载时为空；生产环境由 backup 容器写入 <code>workbench_backups</code> 卷。</p>
        :<div className="table-wrap"><table className="data-table"><thead><tr><th>文件名</th><th>大小</th><th>时间</th><th/></tr></thead><tbody>
          {backups.map(file=><tr key={file.name}><td><code>{file.name}</code></td><td>{formatBytes(file.size)}</td><td>{new Date(file.modifiedAt).toLocaleString("zh-CN",{hour12:false})}</td><td><a href={`/api/backups/${file.name}`} className="export-link"><Download/>下载</a></td></tr>)}
        </tbody></table></div>}
      <div className="notice-box" style={{marginTop:16}}>
        <b>恢复演练</b>（在服务器执行，勿在生产高峰操作）<br/>
        1. 停止应用：<code>docker compose stop app</code><br/>
        2. 恢复：<code>pg_restore -h personal-workbench-db -U workbench -d workbench --clean --if-exists /backups/文件名.dump</code><br/>
        3. 启动应用并访问 <code>/api/health</code> 确认 <code>ok:true</code>
      </div>
    </section>
  </div>;
}
