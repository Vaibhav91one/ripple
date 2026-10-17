CREATE TABLE "org_notify_default" (
	"org_id" text PRIMARY KEY NOT NULL,
	"channels" jsonb,
	"tz" text,
	"quiet_start" text,
	"quiet_end" text,
	"digest_day" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preference" (
	"org_id" text NOT NULL,
	"user_id" text NOT NULL,
	"person_id" text,
	"tz" text,
	"quiet_start" text,
	"quiet_end" text,
	"channels" jsonb,
	"digest" boolean,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "preference_org_id_user_id_unique" UNIQUE("org_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "org_notify_default" ADD CONSTRAINT "org_notify_default_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preference" ADD CONSTRAINT "preference_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;