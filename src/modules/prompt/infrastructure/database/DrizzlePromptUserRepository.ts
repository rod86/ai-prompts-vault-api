import { type DatabaseConnection, type UserSchema } from '@src/config/drizzle/index.js';
import type PromptUserRepositoryInterface from '@src/modules/prompt/domain/interfaces/PromptUserRepositoryInterface.js';
import { type PromptUser } from '@src/modules/prompt/domain/Prompt.js';
import type DatabaseClientInterface from '@src/modules/shared/domain/interfaces/DatabaseClientInterface.js';

export class DrizzlePromptUserRepository implements PromptUserRepositoryInterface {
    constructor(
        private readonly database: DatabaseClientInterface<DatabaseConnection>,
        private readonly schema: UserSchema,
    ) {}

    public async findById(_id: string): Promise<PromptUser | undefined> {
        return undefined;
    }
}
