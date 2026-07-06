export interface Prompt {
    id: string;
    category: { id: string; name: string };
    title: string;
    prompt: string;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface UpdatePrompt {
    categoryId?: string;
    title?: string;
    prompt?: string;
    description?: string | null;
    updatedAt: Date;
}
