CREATE TYPE "public"."deal_status" AS ENUM('DRAFT', 'SUBMITTED', 'SENT_BACK', 'APPROVED', 'REJECTED', 'WITHDRAWN');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('PLANNING', 'LOCKED', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."org_type" AS ENUM('RETAILER', 'VENDOR');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('OPEN', 'ANSWERED', 'DECLINED');--> statement-breakpoint
CREATE TYPE "public"."settlement" AS ENUM('INVOICE', 'DEDUCTION');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('ACTIVE', 'DEACTIVATED');--> statement-breakpoint
CREATE TYPE "public"."vendor_status" AS ENUM('ACTIVE', 'ARCHIVED');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"seq" serial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" text,
	"actor_name" text NOT NULL,
	"action" text NOT NULL,
	"object_type" text NOT NULL,
	"object_id" text NOT NULL,
	"detail" text NOT NULL,
	"ip" text,
	"prev_hash" text NOT NULL,
	"hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" text PRIMARY KEY NOT NULL,
	"deal_id" text NOT NULL,
	"user_id" text,
	"author_name" text NOT NULL,
	"body" text NOT NULL,
	"internal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "counters" (
	"name" text PRIMARY KEY NOT NULL,
	"value" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"deal_id" text NOT NULL,
	"upc" text NOT NULL,
	"description" text NOT NULL,
	"case_pack" integer NOT NULL,
	"case_cost" double precision NOT NULL,
	"regular_retail" double precision NOT NULL,
	"base_weekly_units" integer NOT NULL,
	"cmap" double precision DEFAULT 0 NOT NULL,
	"tpr" double precision DEFAULT 0 NOT NULL,
	"ad" double precision DEFAULT 0 NOT NULL,
	"bill_back" double precision DEFAULT 0 NOT NULL,
	"wholesaler_scan" double precision DEFAULT 0 NOT NULL,
	"retailer_scan" double precision DEFAULT 0 NOT NULL,
	"zone3_retail" double precision,
	"zone4_retail" double precision,
	"zone5_retail" double precision,
	"loyalty_multi" text,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" text PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"vendor_id" text NOT NULL,
	"event_id" text NOT NULL,
	"status" "deal_status" DEFAULT 'DRAFT' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"title" text NOT NULL,
	"header" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"periods" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"store_groups" text[] DEFAULT '{}' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"ad_fee" double precision DEFAULT 0 NOT NULL,
	"accrual_pct" double precision DEFAULT 0 NOT NULL,
	"forecast_units" integer,
	"signer" text,
	"imported" boolean DEFAULT false NOT NULL,
	"created_by_id" text,
	"submitted_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"decided_by_id" text,
	"decided_by_name" text,
	"decision_note" text,
	"auto_approved" boolean DEFAULT false NOT NULL,
	"counter_rate" double precision,
	"rule_version" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deals_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"quarter" text NOT NULL,
	"theme" text,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"vehicles" text[] DEFAULT '{}' NOT NULL,
	"media_budget" double precision DEFAULT 0 NOT NULL,
	"funding_target" double precision DEFAULT 0 NOT NULL,
	"status" "event_status" DEFAULT 'PLANNING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "funding_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"vendor_id" text NOT NULL,
	"event_id" text NOT NULL,
	"promotion_id" text,
	"text" text NOT NULL,
	"status" "request_status" DEFAULT 'OPEN' NOT NULL,
	"deal_id" text,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"upc" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"size" text,
	"uom" text,
	"order_code" text,
	"case_pack" integer NOT NULL,
	"case_cost" double precision NOT NULL,
	"regular_retail" double precision NOT NULL,
	"base_weekly_units" integer DEFAULT 100 NOT NULL,
	"category" text,
	"vendor_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotion_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"promotion_id" text NOT NULL,
	"upc" text NOT NULL,
	"description" text NOT NULL,
	"unit_cost" double precision NOT NULL,
	"regular_retail" double precision NOT NULL,
	"promo_retail" double precision NOT NULL,
	"base_weekly_units" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotions" (
	"id" text PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"name" text NOT NULL,
	"reason" text NOT NULL,
	"event_id" text NOT NULL,
	"brand_vendor_id" text,
	"created_by_id" text,
	"funding_requested" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promotions_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"org" "org_type" NOT NULL,
	"permissions" text[] DEFAULT '{}' NOT NULL,
	"require_mfa" boolean DEFAULT false NOT NULL,
	"system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "rule_sets" (
	"version" serial PRIMARY KEY NOT NULL,
	"values" jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" text NOT NULL,
	"mfa_passed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip" text,
	"user_agent" text,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role_id" text NOT NULL,
	"vendor_id" text,
	"categories" text[] DEFAULT '{}' NOT NULL,
	"status" "user_status" DEFAULT 'ACTIVE' NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"failed_logins" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"totp_secret" text,
	"totp_enabled" boolean DEFAULT false NOT NULL,
	"password_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" text PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"name" text NOT NULL,
	"broker" text,
	"category" text NOT NULL,
	"settlement" "settlement" DEFAULT 'INVOICE' NOT NULL,
	"compliance_score" double precision DEFAULT 0.9 NOT NULL,
	"status" "vendor_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendors_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_lines" ADD CONSTRAINT "deal_lines_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding_requests" ADD CONSTRAINT "funding_requests_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding_requests" ADD CONSTRAINT "funding_requests_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_lines" ADD CONSTRAINT "promotion_lines_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_brand_vendor_id_vendors_id_fk" FOREIGN KEY ("brand_vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_object_idx" ON "audit_log" USING btree ("object_type","object_id");--> statement-breakpoint
CREATE UNIQUE INDEX "audit_hash_idx" ON "audit_log" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "comments_deal_idx" ON "comments" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "deal_lines_deal_idx" ON "deal_lines" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "deal_lines_upc_idx" ON "deal_lines" USING btree ("upc");--> statement-breakpoint
CREATE INDEX "deals_vendor_idx" ON "deals" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "deals_event_idx" ON "deals" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "deals_status_idx" ON "deals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "items_vendor_idx" ON "items" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "promotion_lines_upc_idx" ON "promotion_lines" USING btree ("upc");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_vendor_idx" ON "users" USING btree ("vendor_id");