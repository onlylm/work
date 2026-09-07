import {describe,expect,it} from "vitest";
import {assertBackupFilename,BACKUP_FILENAME} from "@/lib/backups";

describe("backups",()=>{
  it("accepts valid backup names",()=>{
    expect(BACKUP_FILENAME.test("workbench-20260101T120000Z.dump")).toBe(true);
    expect(()=>assertBackupFilename("workbench-20260101T120000Z.dump")).not.toThrow();
  });

  it("rejects traversal",()=>{
    expect(()=>assertBackupFilename("../etc/passwd")).toThrow();
    expect(()=>assertBackupFilename("workbench-evil.dump")).toThrow();
  });
});
