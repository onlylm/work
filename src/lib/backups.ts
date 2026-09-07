import {readdir,stat} from "node:fs/promises";
import path from "node:path";

export const BACKUP_FILENAME=/^workbench-\d{8}T\d{6}Z\.dump$/;

export type BackupFile={
  name:string;
  size:number;
  modifiedAt:string;
};

export function backupDir(){
  return process.env.BACKUP_DIR?.trim()||"/backups";
}

export function assertBackupFilename(name:string){
  if(!BACKUP_FILENAME.test(name))throw new Error("无效的备份文件名");
  const root=backupDir();
  const resolved=path.join(/* turbopackIgnore: true */ root,name);
  if(path.basename(resolved)!==name||resolved.includes(".."))throw new Error("无效的备份路径");
  return resolved;
}

export async function listBackups():Promise<BackupFile[]>{
  const dir=backupDir();
  let entries:string[];
  try{
    entries=await readdir(/* turbopackIgnore: true */ dir);
  }catch{
    return [];
  }
  const files:BackupFile[]=[];
  for(const name of entries){
    if(!BACKUP_FILENAME.test(name))continue;
    try{
      const info=await stat(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ dir,name));
      if(!info.isFile())continue;
      files.push({name,size:info.size,modifiedAt:info.mtime.toISOString()});
    }catch{/* skip unreadable */}
  }
  return files.sort((a,b)=>b.modifiedAt.localeCompare(a.modifiedAt));
}
