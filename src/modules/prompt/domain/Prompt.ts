export type PromptUser = { id: string; name: string };

export type Prompt = {
    id: string;
    category: { id: string; name: string };
    user: PromptUser;
    title: string;
    prompt: string;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
};

export type CreatePrompt = {
    id: string;
    categoryId: string;
    userId: string;
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
