import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {SignJWT,jwtVerify} from "jose";

const COOKIE="workbench_session";
export type Session={userId:string;workspaceId:string;name:string;email:string};
function key(){const value=process.env.AUTH_SECRET;if(!value)throw new Error("AUTH_SECRET 未配置");return new TextEncoder().encode(value)}

export async function createSession(session:Session){
  const token=await new SignJWT(session).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime("7d").sign(key());
  (await cookies()).set(COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:60*60*24*7});
}
export async function getSession():Promise<Session|null>{
  const token=(await cookies()).get(COOKIE)?.value;if(!token)return null;
  try{const {payload}=await jwtVerify(token,key(),{algorithms:["HS256"]});return{userId:String(payload.userId),workspaceId:String(payload.workspaceId),name:String(payload.name),email:String(payload.email)}}catch{return null}
}
export async function requireSession(){const session=await getSession();if(!session)redirect("/login");return session}
export async function clearSession(){(await cookies()).delete(COOKIE)}
