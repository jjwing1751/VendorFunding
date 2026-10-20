CREATE TABLE "guide_progress" (
	"user_id" text NOT NULL,
	"step_key" text NOT NULL,
	"done_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guide_progress_user_id_step_key_pk" PRIMARY KEY("user_id","step_key")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "guide_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "guide_progress" ADD CONSTRAINT "guide_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;