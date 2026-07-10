import { desc, eq, sql } from 'drizzle-orm';
import type PromptRepositoryInterface from '@src/modules/prompt/domain/interfaces/PromptRepositoryInterface.js';
import {
    type CreatePrompt,
    type Prompt,
    type PromptFilter,
    type UpdatePrompt,
} from '@src/modules/prompt/domain/Prompt.js';
import { promptCategories, prompts } from '@src/modules/prompt/infrastructure/database/schema.js';
import type DatabaseClientInterface from '@src/modules/shared/domain/interfaces/DatabaseClientInterface.js';
import { type DatabaseSchema } from '@src/modules/shared/services.js';

export class DrizzlePromptRepository implements PromptRepositoryInterface {
    constructor(private readonly database: DatabaseClientInterface<DatabaseSchema>) {}

    public async findAll(filter?: PromptFilter): Promise<Prompt[]> {
        const db = this.database.getConnection();

        // Compared as text (not uuid) so a filter value that isn't UUID-shaped
        // simply matches nothing instead of erroring at the database (spec §3/§6 Decision 4).
        const whereClause = filter?.categoryId
            ? eq(sql`${prompts.promptCategoryId}::text`, filter.categoryId)
            : undefined;

        const rows = await db
            .select({
                id: prompts.id,
                title: prompts.title,
                prompt: prompts.prompt,
                description: prompts.description,
                createdAt: prompts.createdAt,
                updatedAt: prompts.updatedAt,
                categoryId: promptCategories.id,
                categoryName: promptCategories.name,
            })
            .from(prompts)
            .innerJoin(promptCategories, eq(prompts.promptCategoryId, promptCategories.id))
            .where(whereClause)
            .orderBy(desc(prompts.createdAt), prompts.id);

        return rows.map((row) => ({
            id: row.id,
            category: { id: row.categoryId, name: row.categoryName },
            title: row.title,
            prompt: row.prompt,
            description: row.description ?? undefined,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        }));
    }

    public async findById(id: string): Promise<Prompt | undefined> {
        const db = this.database.getConnection();

        const rows = await db
            .select({
                id: prompts.id,
                title: prompts.title,
                prompt: prompts.prompt,
                description: prompts.description,
                createdAt: prompts.createdAt,
                updatedAt: prompts.updatedAt,
                categoryId: promptCategories.id,
                categoryName: promptCategories.name,
            })
            .from(prompts)
            .innerJoin(promptCategories, eq(prompts.promptCategoryId, promptCategories.id))
            .where(eq(sql`${prompts.id}::text`, id))
            .limit(1);

        const row = rows[0];

        if (!row) {
            return undefined;
        }

        return {
            id: row.id,
            category: { id: row.categoryId, name: row.categoryName },
            title: row.title,
            prompt: row.prompt,
            description: row.description ?? undefined,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }

    public async create(prompt: CreatePrompt): Promise<void> {
        const db = this.database.getConnection();

        await db.insert(prompts).values({
            id: prompt.id,
            promptCategoryId: prompt.categoryId,
            title: prompt.title,
            prompt: prompt.prompt,
            description: prompt.description ?? null,
            createdAt: prompt.createdAt,
            updatedAt: prompt.updatedAt,
        });
    }

    public async update(id: string, prompt: UpdatePrompt): Promise<void> {
        const db = this.database.getConnection();

        await db
            .update(prompts)
            .set({
                ...(prompt.categoryId !== undefined && { promptCategoryId: prompt.categoryId }),
                ...(prompt.title !== undefined && { title: prompt.title }),
                ...(prompt.prompt !== undefined && { prompt: prompt.prompt }),
                ...(prompt.description !== undefined && { description: prompt.description }),
                updatedAt: prompt.updatedAt,
            })
            .where(eq(prompts.id, id));
    }

    public async delete(id: string): Promise<void> {
        const db = this.database.getConnection();

        await db.delete(prompts).where(eq(prompts.id, id));
    }
}
