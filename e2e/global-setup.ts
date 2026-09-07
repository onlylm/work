import {execSync} from "node:child_process";

export default async function globalSetup(){
  if(!process.env.DATABASE_URL){
    process.env.DATABASE_URL="postgres://workbench:test@127.0.0.1:5432/workbench";
  }
  if(!process.env.AUTH_SECRET)process.env.AUTH_SECRET="e2e-test-auth-secret-32chars-min!!";
  if(!process.env.INVENTORY_ENCRYPTION_KEY)process.env.INVENTORY_ENCRYPTION_KEY="e2e-test-inventory-key-32bytes!!";
  if(!process.env.ADMIN_EMAIL)process.env.ADMIN_EMAIL="admin@e2e.test";
  if(!process.env.ADMIN_PASSWORD)process.env.ADMIN_PASSWORD="e2e-test-password";
  execSync("pnpm db:migrate",{stdio:"inherit",env:process.env});
}
