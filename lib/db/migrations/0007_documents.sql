CREATE TABLE "document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"source_kind" text NOT NULL,
	"source_ref" text,
	"title" text NOT NULL,
	"text" text NOT NULL,
	"sha256" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_org_sha_uq" UNIQUE("org_id","sha256")
);
--> statement-breakpoint
CREATE TABLE "entity_alias" (
	"org_id" text NOT NULL,
	"kind" text NOT NULL,
	"alias_norm" text NOT NULL,
	"node_id" text NOT NULL,
	CONSTRAINT "entity_alias_org_id_kind_alias_norm_pk" PRIMARY KEY("org_id","kind","alias_norm")
);
--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_alias" ADD CONSTRAINT "entity_alias_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entity_alias_node_idx" ON "entity_alias" USING btree ("org_id","node_id");