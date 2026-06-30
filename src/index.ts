import { createApp } from './app.js';
import { env } from './config/env.js';

/**
 * Composition root + server bootstrap. Wires dependencies (later), creates the
 * Express app and starts listening.
 */
function main(): void {
  const app = createApp();

  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`AI Prompt Vault API listening on http://localhost:${env.PORT}`);
  });
}

main();
