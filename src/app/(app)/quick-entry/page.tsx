import {PageHeader} from "@/components/ui";import {QuickEntry} from "@/components/quick-entry";
export default function QuickEntryPage(){return <div className="page"><PageHeader title="快速记录" description="自然语言内容必须预览确认，系统不会直接修改账目"/><QuickEntry/><div className="notice-box">当前版本使用本地固定规则识别常见业务句式，不会把账号、密码、2FA 或卡密发送给外部 AI。</div></div>}
