CREATE TABLE "change_channel" (
	"org_id" text NOT NULL,
	"change_id" text NOT NULL,
	"slack_team_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "change_channel_change_uq" UNIQUE("org_id","change_id")
);
--> statement-breakpoint
ALTER TABLE "change_channel" ADD CONSTRAINT "change_channel_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "change_channel_channel_idx" ON "change_channel" USING btree ("org_id","channel_id");