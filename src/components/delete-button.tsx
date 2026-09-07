"use client";

export function ConfirmSubmitButton({label,confirmText,className}:{label:string;confirmText:string;className?:string}){
  return <button type="submit" className={className??"danger-button"} onClick={e=>{if(!window.confirm(confirmText))e.preventDefault()}}>{label}</button>;
}
