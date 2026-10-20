CREATE TABLE "billing_records" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_number" text NOT NULL,
	"deal_number" text NOT NULL,
	"vendor_number" text,
	"invoice_date" date,
	"method" text,
	"billed" double precision DEFAULT 0 NOT NULL,
	"collected" double precision DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"upload_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_records_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "data_uploads" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"file_name" text NOT NULL,
	"rows" integer DEFAULT 0 NOT NULL,
	"skipped" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"upc" text NOT NULL,
	"week_start" date NOT NULL,
	"cases" double precision NOT NULL,
	"cost" double precision NOT NULL,
	"upload_id" text,
	CONSTRAINT "receipts_upc_week_start_pk" PRIMARY KEY("upc","week_start")
);
--> statement-breakpoint
CREATE TABLE "sales_actuals" (
	"upc" text NOT NULL,
	"week_start" date NOT NULL,
	"units" double precision NOT NULL,
	"sales" double precision,
	"upload_id" text,
	CONSTRAINT "sales_actuals_upc_week_start_pk" PRIMARY KEY("upc","week_start")
);
--> statement-breakpoint
CREATE INDEX "billing_deal_idx" ON "billing_records" USING btree ("deal_number");--> statement-breakpoint
CREATE INDEX "receipts_week_idx" ON "receipts" USING btree ("week_start");--> statement-breakpoint
CREATE INDEX "sales_week_idx" ON "sales_actuals" USING btree ("week_start");