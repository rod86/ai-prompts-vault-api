import * as promptSchema from '@src/modules/prompt/infrastructure/database/schema.js';
import * as userSchema from '@src/modules/user/infrastructure/database/schema.js';

export default {
    ...promptSchema,
    ...userSchema,
};
