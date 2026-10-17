CREATE TABLE "agent_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"agent" text NOT NULL,
	"trigger" text NOT NULL,
	"input" jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"output" jsonb,
	"tokens" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "run_step" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"n" integer NOT NULL,
	"kind" text NOT NULL,
	"tool" text,
	"args" jsonb,
	"cypher" text[] DEFAULT '{}' NOT NULL,
	"source_ids" text[] DEFAULT '{}' NOT NULL,
	"tokens" integer DEFAULT 0 NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "run_step" ADD CONSTRAINT "run_step_run_id_agent_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_run_org_started_idx" ON "agent_run" USING btree ("org_id","started_at");--> statement-breakpoint
CREATE INDEX "run_step_run_idx" ON "run_step" USING btree ("run_id","n");