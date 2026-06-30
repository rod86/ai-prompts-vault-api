import app from './app.js';
import { env } from './config/env.js';

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`AI Prompt Vault API listening on http://localhost:${env.PORT}`);
});
