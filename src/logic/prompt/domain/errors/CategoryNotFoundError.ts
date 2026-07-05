export class CategoryNotFoundError extends Error {
    constructor(id: string) {
        super(`Category not found: ${id}`);
        this.name = 'CategoryNotFoundError';
    }
}
