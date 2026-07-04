import { type PromptCategory } from '@logic/prompt/domain/PromptCategory.js';

export default interface PromptCategoryRepositoryInterface {
    findAll(): Promise<PromptCategory[]>;
}
