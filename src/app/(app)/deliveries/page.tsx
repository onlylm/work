import {Empty,PageHeader} from "@/components/ui";
export default function Deliveries(){return <div className="page"><PageHeader title="账号交付" description="敏感库存的加密入库、提取与交付审计"/><section className="content-card list-card"><Empty title="账号交付功能尚未启用" description="该模块涉及密码、2FA 与卡密，将在完成加密和并发提取测试后开放，避免不安全的半成品功能。"/></section></div>}
