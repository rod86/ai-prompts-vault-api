import { PromptCategory } from '@logic/prompts/domain/PromptCategory.js';

export default interface PromptCategoryRepositoryInterface {
    findAll(): Promise<PromptCategory[]>;
}
