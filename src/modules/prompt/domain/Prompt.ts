export type Prompt = {
    id: string;
    category: { id: string; name: string };
    title: string;
    prompt: string;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
};

export type UpdatePrompt = {
    categoryId?: string;
    title?: string;
    prompt?: string;
    description?: string | null;
    updatedAt: Date;
};

export type PromptFilter = {
    categoryId?: string;
};
