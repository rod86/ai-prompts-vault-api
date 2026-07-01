import { PromptCategory } from '@logic/prompts/domain/PromptCategory.js';

export default interface CategoryRepositoryInterface {
    findAll(): Promise<PromptCategory[]>;
}
