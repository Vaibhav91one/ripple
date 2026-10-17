CREATE TABLE "team_channel" (
	"org_id" text NOT NULL,
	"team_id" text NOT NULL,
	"slack_channel_id" text NOT NULL,
	CONSTRAINT "team_channel_org_id_team_id_pk" PRIMARY KEY("org_id","team_id")
);
--> statement-breakpoint
ALTER TABLE "team_channel" ADD CONSTRAINT "team_channel_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;