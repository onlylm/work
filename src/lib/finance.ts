export type UsdPool={usd:number;costCents:number};
export function recharge(pool:UsdPool,usd:number,costCents:number):UsdPool{if(usd<=0||costCents<0)throw new Error("充值金额无效");return{usd:round4(pool.usd+usd),costCents:pool.costCents+costCents}}
export function consume(pool:UsdPool,usd:number){if(usd<=0||usd>pool.usd)throw new Error("美元余额不足");const costCents=Math.round(usd*(pool.costCents/pool.usd));return{costCents,pool:{usd:round4(pool.usd-usd),costCents:pool.costCents-costCents}}}
export function averageCost(pool:UsdPool){return pool.usd?pool.costCents/100/pool.usd:0}
export function profit(revenueCents:number,costCents:number|null,direct=0,refund=0){return costCents===null?null:revenueCents-costCents-direct-refund}
const round4=(n:number)=>Math.round(n*10000)/10000;
