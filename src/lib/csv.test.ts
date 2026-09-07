import {describe,expect,it} from "vitest";
import {parseCsv,toCsv} from "./csv";

describe("csv",()=>{
  it("导出并解析往返",()=>{
    const csv=toCsv(["姓名","手机"],[["张三","138"],["李\"四", "a,b"]]);
    const rows=parseCsv(csv.replace(/^\uFEFF/,""));
    expect(rows[1]).toEqual(["张三","138"]);
    expect(rows[2]).toEqual(['李"四',"a,b"]);
  });
});
