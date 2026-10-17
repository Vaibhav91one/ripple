CREATE TABLE "org_policy" (
	"org_id" text NOT NULL,
	"action_kind" text NOT NULL,
	"auto_approve" boolean DEFAULT false NOT NULL,
	CONSTRAINT "org_policy_org_id_action_kind_pk" PRIMARY KEY("org_id","action_kind")
);
--> statement-breakpoint
CREATE TABLE "pending_action" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"run_id" uuid,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"idempotency_key" text NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approver" text,
	"decided_at" timestamp with time zone,
	"result" jsonb,
	"error" text,
	CONSTRAINT "pending_action_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE INDEX "pending_action_org_status_idx" ON "pending_action" USING btree ("org_id","status");