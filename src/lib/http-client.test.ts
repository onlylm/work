import {afterEach,describe,expect,it,vi} from "vitest";
import {fetchWithRetry} from "@/lib/http-client";

describe("fetchWithRetry",()=>{
  afterEach(()=>vi.unstubAllGlobals());

  it("returns ok response",async()=>{
    vi.stubGlobal("fetch",vi.fn(async()=>new Response("ok",{status:200})));
    const res=await fetchWithRetry("https://example.test/health");
    expect(res.status).toBe(200);
  });

  it("retries server errors",async()=>{
    const fetchMock=vi.fn()
      .mockResolvedValueOnce(new Response("bad",{status:503}))
      .mockResolvedValueOnce(new Response("ok",{status:200}));
    vi.stubGlobal("fetch",fetchMock);
    const res=await fetchWithRetry("https://example.test/health",{retries:1,retryDelayMs:1});
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
