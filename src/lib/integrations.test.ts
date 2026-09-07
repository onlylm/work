import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {listIntegrationStatus,pingIntegration} from "@/lib/integrations";

describe("integrations",()=>{
  const env=process.env;

  beforeEach(()=>{
    process.env={...env};
    delete process.env.SHUKU_API_URL;
    delete process.env.SHUKU_API_KEY;
  });

  afterEach(()=>vi.unstubAllGlobals());

  it("lists unconfigured integrations",()=>{
    const rows=listIntegrationStatus();
    expect(rows.find(x=>x.name==="shuku")?.configured).toBe(false);
  });

  it("pings configured integration",async()=>{
    process.env.SHUKU_API_URL="https://shuku.test";
    process.env.SHUKU_API_KEY="secret";
    vi.stubGlobal("fetch",vi.fn(async()=>new Response("{}",{status:200})));
    const result=await pingIntegration("shuku");
    expect(result.ok).toBe(true);
  });
});
