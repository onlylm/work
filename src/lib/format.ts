export function cny(cents:number|null|undefined){return cents==null?"待核算":new Intl.NumberFormat("zh-CN",{style:"currency",currency:"CNY"}).format(cents/100)}
export function datetime(value:Date|string){return new Intl.DateTimeFormat("zh-CN",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(new Date(value))}
export const businessTypeName:Record<string,string>={membership:"会员充值",account:"账号产品",physical:"实物产品",service:"服务",other:"其他"};
export const businessStatusName:Record<string,string>={pending_payment:"待付款",paid_pending:"已付款待办理",processing:"办理中",completed:"已完成",after_sale:"售后",refunded:"已退款"};
