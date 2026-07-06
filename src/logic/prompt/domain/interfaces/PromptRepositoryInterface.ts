import { type Prompt, type UpdatePrompt } from '@logic/prompt/domain/Prompt.js';

export interface PromptFilter {
    categoryId?: string;
}

export default interface PromptRepositoryInterface {
    findAll(filter?: PromptFilter): Promise<Prompt[]>;
    findById(id: string): Promise<Prompt | undefined>;
    create(prompt: Prompt): Promise<void>;
    update(id: string, prompt: UpdatePrompt): Promise<void>;
}
