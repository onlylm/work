export type FetchWithRetryOptions=RequestInit&{
  timeoutMs?:number;
  retries?:number;
  retryDelayMs?:number;
};

function sleep(ms:number){return new Promise(r=>setTimeout(r,ms));}

export async function fetchWithRetry(url:string,options:FetchWithRetryOptions={}):Promise<Response>{
  const {timeoutMs=5000,retries=2,retryDelayMs=400,...init}=options;
  let lastError:unknown;
  for(let attempt=0;attempt<=retries;attempt++){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const res=await fetch(url,{...init,signal:controller.signal});
      clearTimeout(timer);
      if(res.ok||res.status<500||attempt===retries)return res;
      lastError=new Error(`HTTP ${res.status}`);
    }catch(e){
      clearTimeout(timer);
      lastError=e;
      if(attempt===retries)break;
      await sleep(retryDelayMs*(attempt+1));
    }
  }
  throw lastError instanceof Error?lastError:new Error("请求失败");
}
