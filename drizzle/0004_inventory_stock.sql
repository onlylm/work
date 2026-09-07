ALTER TABLE "products" ADD COLUMN "stock_quantity" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"type" varchar(16) NOT NULL,
	"quantity" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"notes" text,
	"business_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_business_id_business_records_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business_records"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "stock_movement_product_idx" ON "stock_movements" USING btree ("workspace_id","product_id");
