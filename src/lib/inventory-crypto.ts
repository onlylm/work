import {createCipheriv,createDecipheriv,createHash,randomBytes,scryptSync} from "node:crypto";

const SALT="workbench-inventory-v1";

function key(){
  const secret=process.env.INVENTORY_ENCRYPTION_KEY;
  if(!secret)throw new Error("INVENTORY_ENCRYPTION_KEY 未配置");
  return scryptSync(secret,SALT,32);
}

export function encryptPayload(plain:string){
  const iv=randomBytes(12);
  const cipher=createCipheriv("aes-256-gcm",key(),iv);
  const enc=Buffer.concat([cipher.update(plain,"utf8"),cipher.final()]);
  const tag=cipher.getAuthTag();
  return Buffer.concat([iv,tag,enc]).toString("base64");
}

export function decryptPayload(encoded:string){
  const buf=Buffer.from(encoded,"base64");
  const iv=buf.subarray(0,12);
  const tag=buf.subarray(12,28);
  const data=buf.subarray(28);
  const decipher=createDecipheriv("aes-256-gcm",key(),iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data),decipher.final()]).toString("utf8");
}

export function payloadHash(workspaceId:string,productId:string,plain:string){
  return createHash("sha256").update(`${workspaceId}:${productId}:${plain}`).digest("hex");
}

export function maskPayload(plain:string){
  if(plain.length<=4)return "****";
  return `${plain.slice(0,2)}${"*".repeat(Math.min(plain.length-4,8))}${plain.slice(-2)}`;
}
