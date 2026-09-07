import {z} from "zod";

export const text=(min=1,max=300)=>z.string().trim().min(min).max(max);

export function parseMoney(value:FormDataEntryValue|null,label="金额"):number|null{
  if(value==null||String(value).trim()==="")return null;
  const n=Number(value);
  if(!Number.isFinite(n)||n<0)throw new Error(`${label}格式错误`);
  return Math.round(n*100);
}

export function parseRequiredMoney(value:FormDataEntryValue|null,label="金额"):number{
  const cents=parseMoney(value,label);
  if(cents==null)throw new Error(`${label}不能为空`);
  return cents;
}

export function parseWhen(value:FormDataEntryValue|null):Date{
  const d=value?new Date(String(value)):new Date();
  if(Number.isNaN(d.getTime()))throw new Error("时间格式错误");
  return d;
}

export function optionalUuid(value:FormDataEntryValue|null):string|null{
  const raw=String(value??"").trim();
  if(!raw)return null;
  return z.string().uuid().parse(raw);
}

export function requiredUuid(value:FormDataEntryValue|null,label="记录"):string{
  const raw=String(value??"").trim();
  if(!raw)throw new Error(`缺少${label} ID`);
  return z.string().uuid().parse(raw);
}
