import { createDocument } from 'zod-openapi';
import { authPaths } from '@src/docs/auth.js';
import { healthPaths } from '@src/docs/health.js';

export const openApiDocument = createDocument({
    openapi: '3.1.0',
    info: {
        title: 'AI Prompts Vault API',
        version: '0.1.0',
    },
    servers: [{ url: '/' }],
    tags: [{ name: 'Health' }, { name: 'Authentication' }, { name: 'Users' }, { name: 'Prompts' }],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
            },
        },
    },
    paths: {
        ...healthPaths,
        ...authPaths,
    },
});
