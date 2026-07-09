import {
    type CreatePrompt,
    type Prompt,
    type PromptFilter,
    type UpdatePrompt,
} from '@src/modules/prompt/domain/Prompt.js';

export default interface PromptRepositoryInterface {
    findAll(filter?: PromptFilter): Promise<Prompt[]>;
    findById(id: string): Promise<Prompt | undefined>;
    create(prompt: CreatePrompt): Promise<void>;
    update(id: string, prompt: UpdatePrompt): Promise<void>;
    delete(id: string): Promise<void>;
}
