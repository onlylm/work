export function FlashBanner({success,error}:{success?:string;error?:string}){
  if(!success&&!error)return null;
  return success?<div className="flash flash-success">{success}</div>:<div className="flash flash-error">{error}</div>;
}
