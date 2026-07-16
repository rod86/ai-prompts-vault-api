import { type PromptUser } from '@src/modules/prompt/domain/Prompt.js';

export default interface PromptUserRepositoryInterface {
    findById(id: string): Promise<PromptUser | undefined>;
}
