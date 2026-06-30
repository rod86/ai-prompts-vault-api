import app from './app.js';
import config from './config.js';

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`AI Prompt Vault API listening on http://localhost:${config.port}`);
});
