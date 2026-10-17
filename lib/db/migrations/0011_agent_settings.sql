CREATE TABLE "agent_setting" (
	"org_id" text NOT NULL,
	"agent" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	CONSTRAINT "agent_setting_org_id_agent_pk" PRIMARY KEY("org_id","agent")
);
