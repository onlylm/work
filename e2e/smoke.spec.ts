import {expect,test} from "@playwright/test";

test.describe("工作台冒烟",()=>{
  test("健康检查",async({request})=>{
    const res=await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
    const body=await res.json();
    expect(body.ok).toBe(true);
  });

  test("登录并访问仪表盘",async({page})=>{
    await page.goto("/login");
    await page.getByLabel("邮箱地址").fill(process.env.ADMIN_EMAIL||"admin@e2e.test");
    await page.getByLabel("密码").fill(process.env.ADMIN_PASSWORD||"e2e-test-password");
    await page.getByRole("button",{name:"登录工作台"}).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText("今日经营概览")).toBeVisible();
  });

  test("设置页导出链接需登录",async({request})=>{
    const res=await request.get("/api/export/customers");
    expect(res.status()).toBe(401);
  });
});
