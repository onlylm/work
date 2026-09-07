"use client";
import {useMemo,useState} from "react";

type ProductOption={id:string;name:string;type:string;defaultPriceCents:number|null;defaultCostCents:number|null};

export function BusinessCreateForm({customers,products,action,defaults,submitLabel="确认并记录",recordId}:{customers:{id:string;name:string}[];products:ProductOption[];action:(data:FormData)=>void|Promise<void>;defaults?:{customerId?:string;productId?:string;type?:string;content?:string;revenue?:string;cost?:string;directExpense?:string;occurredAt?:string;status?:string};submitLabel?:string;recordId?:string}){
  const [productId,setProductId]=useState(defaults?.productId??"");
  const selected=useMemo(()=>products.find(x=>x.id===productId),[productId,products]);
  return <form action={action} className="data-form">
    {recordId&&<input type="hidden" name="id" value={recordId}/>}
    <label>客户<select name="customerId" defaultValue={defaults?.customerId??""}><option value="">未关联客户</option>{customers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    <label>关联商品<select name="productId" value={productId} onChange={e=>setProductId(e.target.value)}><option value="">不关联商品</option>{products.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    <label>业务类型<select name="type" defaultValue={defaults?.type??selected?.type??"other"} key={`type-${selected?.id??"none"}`}><option value="membership">会员充值</option><option value="account">账号产品</option><option value="physical">实物产品</option><option value="service">服务</option><option value="other">其他</option></select></label>
    <label className="wide">业务内容<input name="content" required maxLength={500} defaultValue={defaults?.content??""}/></label>
    <label>收款（元）<input name="revenue" type="number" min="0" step="0.01" defaultValue={defaults?.revenue??(selected?.defaultPriceCents!=null?String(selected.defaultPriceCents/100):"0")} key={`rev-${selected?.id??"none"}`} required/></label>
    <label>成本（元，可留空）<input name="cost" type="number" min="0" step="0.01" defaultValue={defaults?.cost??(selected?.defaultCostCents!=null?String(selected.defaultCostCents/100):"")} key={`cost-${selected?.id??"none"}`}/></label>
    <label>直接支出（元）<input name="directExpense" type="number" min="0" step="0.01" defaultValue={defaults?.directExpense??"0"}/></label>
    <label>业务时间<input name="occurredAt" type="datetime-local" defaultValue={defaults?.occurredAt??""}/></label>
    <label>状态<select name="status" defaultValue={defaults?.status??"paid_pending"}><option value="paid_pending">已付款待办理</option><option value="pending_payment">待付款</option><option value="processing">办理中</option><option value="completed">已完成</option><option value="after_sale">售后</option><option value="refunded">已退款</option></select></label>
    <button>{submitLabel}</button>
  </form>;
}
