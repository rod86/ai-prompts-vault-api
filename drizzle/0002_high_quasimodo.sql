CREATE TABLE "prompts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"prompt_category_id" uuid NOT NULL,
	"title" text NOT NULL,
	"prompt" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_prompt_category_id_prompt_categories_id_fk" FOREIGN KEY ("prompt_category_id") REFERENCES "public"."prompt_categories"("id") ON DELETE no action ON UPDATE no action;