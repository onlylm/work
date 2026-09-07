export function csvCell(value:string|number|null|undefined){
  const raw=value==null?"":String(value);
  if(/[",\n\r]/.test(raw))return `"${raw.replace(/"/g,'""')}"`;
  return raw;
}

export function toCsv(headers:string[],rows:(string|number|null|undefined)[][]){
  const lines=[headers.map(csvCell).join(",")];
  for(const row of rows)lines.push(row.map(csvCell).join(","));
  return `\uFEFF${lines.join("\n")}`;
}

export function parseCsv(text:string){
  const lines=text.replace(/^\uFEFF/,"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(!lines.length)return [] as string[][];
  return lines.map(line=>{
    const cells:string[]=[];
    let cur="";
    let inQuote=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(inQuote){
        if(ch==='"'&&line[i+1]==='"'){cur+='"';i++;}
        else if(ch==='"')inQuote=false;
        else cur+=ch;
      }else if(ch===","){cells.push(cur);cur="";}
      else if(ch==='"')inQuote=true;
      else cur+=ch;
    }
    cells.push(cur);
    return cells;
  });
}
