import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('config.ts startup', () => {
    it('refuses to start on an invalid setting and does not echo the supplied value', () => {
        const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/config/config.ts'], {
            env: { ...process.env, JWT_SECRET: 'short-secret-sentinel' },
            encoding: 'utf8',
        });

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('JWT_SECRET');
        expect(result.stderr).not.toContain('short-secret-sentinel');
    });
});
