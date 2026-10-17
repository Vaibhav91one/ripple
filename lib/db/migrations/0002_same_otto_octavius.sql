CREATE TABLE "connector_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"kind" text NOT NULL,
	"external_id" text NOT NULL,
	"token_enc" text,
	"scopes" text[] DEFAULT '{}' NOT NULL,
	"cursor" jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "connector_account_org_kind_external_uq" UNIQUE("org_id","kind","external_id")
);
--> statement-breakpoint
ALTER TABLE "connector_account" ADD CONSTRAINT "connector_account_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;