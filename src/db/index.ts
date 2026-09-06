import {drizzle,PostgresJsDatabase} from "drizzle-orm/postgres-js";
import postgres, {Sql} from "postgres";
import * as schema from "./schema";

let client:Sql|undefined;
let database:PostgresJsDatabase<typeof schema>|undefined;

export function getDb(){
  if(database)return database;
  const url=process.env.DATABASE_URL;
  if(!url)throw new Error("DATABASE_URL 未配置");
  client=postgres(url,{max:8,prepare:false,idle_timeout:20});
  database=drizzle(client,{schema});
  return database;
}
