import Link from "next/link";
import {Empty,PageHeader} from "@/components/ui";

export default function Deliveries(){return <div className="page">
  <PageHeader title="账号交付" description="敏感库存的加密入库、提取与交付审计"/>
  <section className="content-card list-card">
    <Empty title="独立交付页尚未开放" description="加密领取与一次性展示已在「商品详情 → 导入库存」和「业务详情 → 领取库存」中可用。完成安全评审前，侧栏入口保持关闭。"/>
    <p style={{marginTop:16}}><Link href="/products">前往商品管理</Link> · <Link href="/business">前往业务流水</Link></p>
  </section>
</div>}
