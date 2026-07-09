import { type PromptCategory } from '@src/modules/prompt/domain/PromptCategory.js';

export default interface PromptCategoryRepositoryInterface {
    findAll(): Promise<PromptCategory[]>;
    findById(id: string): Promise<PromptCategory | undefined>;
}
