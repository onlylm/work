import {fetchWithRetry} from "@/lib/http-client";

export type IntegrationName="shuku"|"nimail";
export type IntegrationAuthStyle="bearer"|"header";

type IntegrationConfig={
  name:IntegrationName;
  label:string;
  apiUrl:string;
  apiKey:string;
  healthPath:string;
  authStyle:IntegrationAuthStyle;
};

export type IntegrationStatus={
  name:IntegrationName;
  label:string;
  configured:boolean;
  hint:string;
  healthPath:string;
};

const INTEGRATIONS:Record<IntegrationName,{label:string;urlKey:string;keyKey:string;healthKey:string;authKey:string}>={
  shuku:{label:"shuku",urlKey:"SHUKU_API_URL",keyKey:"SHUKU_API_KEY",healthKey:"SHUKU_HEALTH_PATH",authKey:"SHUKU_AUTH_STYLE"},
  nimail:{label:"NIMAIL",urlKey:"NIMAIL_API_URL",keyKey:"NIMAIL_API_KEY",healthKey:"NIMAIL_HEALTH_PATH",authKey:"NIMAIL_AUTH_STYLE"},
};

function authStyle(raw:string|undefined):IntegrationAuthStyle{
  return raw?.trim().toLowerCase()==="header"?"header":"bearer";
}

function readConfig(name:IntegrationName):IntegrationConfig|null{
  const meta=INTEGRATIONS[name];
  const apiUrl=process.env[meta.urlKey]?.trim();
  const apiKey=process.env[meta.keyKey]?.trim();
  if(!apiUrl||!apiKey)return null;
  const healthPath=process.env[meta.healthKey]?.trim()||"/api/health";
  return {name,label:meta.label,apiUrl,apiKey,healthPath,authStyle:authStyle(process.env[meta.authKey])};
}

function authHeaders(config:IntegrationConfig):HeadersInit{
  if(config.authStyle==="header")return {"X-API-Key":config.apiKey};
  return {Authorization:`Bearer ${config.apiKey}`};
}

export function listIntegrationStatus():IntegrationStatus[]{
  return (Object.keys(INTEGRATIONS) as IntegrationName[]).map(name=>{
    const meta=INTEGRATIONS[name];
    const config=readConfig(name);
    const healthPath=process.env[meta.healthKey]?.trim()||"/api/health";
    return {
      name,
      label:meta.label,
      configured:Boolean(config),
      healthPath,
      hint:config
        ? `已配置 · 探测 ${healthPath}（超时 5s，失败自动重试）`
        : `需配置 ${meta.urlKey} 与 ${meta.keyKey}（仅服务端）`,
    };
  });
}

export async function pingIntegration(name:IntegrationName):Promise<{ok:boolean;message:string;status?:number}>{
  const config=readConfig(name);
  if(!config)return{ok:false,message:"未配置环境变量"};
  const base=config.apiUrl.replace(/\/+$/,"");
  const path=config.healthPath.startsWith("/")?config.healthPath:`/${config.healthPath}`;
  const url=`${base}${path}`;
  try{
    const res=await fetchWithRetry(url,{method:"GET",headers:authHeaders(config),timeoutMs:5000,retries:2});
    if(res.ok)return{ok:true,message:`连通正常（HTTP ${res.status}）`,status:res.status};
    return{ok:false,message:`服务响应异常（HTTP ${res.status}）`,status:res.status};
  }catch(e){
    const msg=e instanceof Error?e.message:"未知错误";
    return{ok:false,message:`无法连接：${msg}`};
  }
}
