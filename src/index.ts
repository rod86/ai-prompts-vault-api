import { databaseClient } from '@src/modules/shared/services.js';
import app from './app.js';
import config from './config/config.js';

databaseClient.connect();

const server = app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`AI Prompt Vault API listening on http://localhost:${config.port}`);
});

async function shutdown(): Promise<void> {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await databaseClient.close();
    process.exit(0);
}

process.on('SIGINT', () => {
    void shutdown();
});

process.on('SIGTERM', () => {
    void shutdown();
});
