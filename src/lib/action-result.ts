import {ZodError} from "zod";

export type ActionResult={ok:true;message?:string}|{ok:false;error:string};

export function ok(message?:string):ActionResult{return{ok:true,message}}
export function fail(error:string):ActionResult{return{ok:false,error}}

export function actionError(error:unknown):string{
  if(error instanceof ZodError){
    const issue=error.issues[0];
    if(issue?.message)return issue.message;
    return "表单填写有误，请检查后重试";
  }
  if(error instanceof Error)return error.message;
  return "操作失败，请稍后重试";
}
