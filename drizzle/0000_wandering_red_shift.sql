CREATE TABLE "prompt_categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "prompt_categories_name_unique" UNIQUE("name")
);
