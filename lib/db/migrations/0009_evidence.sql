CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"change_id" text NOT NULL,
	"team_id" text,
	"channel_id" text NOT NULL,
	"message_ts" text NOT NULL,
	"permalink" text,
	"author_slack_id" text,
	"person_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_msg_change_uq" UNIQUE("org_id","change_id","channel_id","message_ts")
);
--> statement-breakpoint
CREATE INDEX "evidence_change_idx" ON "evidence" USING btree ("org_id","change_id");