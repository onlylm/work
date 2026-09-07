CREATE TYPE "public"."membership_status" AS ENUM('active', 'expired', 'cancelled');
--> statement-breakpoint
CREATE TABLE "membership_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"platform" varchar(80) NOT NULL,
	"plan_name" varchar(120) NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revenue_cents" bigint DEFAULT 0 NOT NULL,
	"cost_cents" bigint,
	"status" "membership_status" DEFAULT 'active' NOT NULL,
	"business_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membership_renewals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"renewed_at" timestamp with time zone NOT NULL,
	"previous_expires_at" timestamp with time zone NOT NULL,
	"new_expires_at" timestamp with time zone NOT NULL,
	"revenue_cents" bigint DEFAULT 0 NOT NULL,
	"cost_cents" bigint,
	"business_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "membership_subscriptions" ADD CONSTRAINT "membership_subscriptions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "membership_subscriptions" ADD CONSTRAINT "membership_subscriptions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "membership_subscriptions" ADD CONSTRAINT "membership_subscriptions_business_id_business_records_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business_records"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "membership_renewals" ADD CONSTRAINT "membership_renewals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "membership_renewals" ADD CONSTRAINT "membership_renewals_subscription_id_membership_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."membership_subscriptions"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "membership_renewals" ADD CONSTRAINT "membership_renewals_business_id_business_records_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business_records"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "membership_workspace_expires_idx" ON "membership_subscriptions" USING btree ("workspace_id","expires_at");
--> statement-breakpoint
CREATE INDEX "membership_customer_idx" ON "membership_subscriptions" USING btree ("customer_id");
--> statement-breakpoint
CREATE INDEX "membership_renewal_sub_idx" ON "membership_renewals" USING btree ("subscription_id");
