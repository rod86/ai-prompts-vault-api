import { randomUUID } from 'node:crypto';
import type IdGeneratorInterface from '@src/modules/shared/domain/interfaces/IdGeneratorInterface.js';

export class UuidGenerator implements IdGeneratorInterface {
    public generate(): string {
        return randomUUID();
    }
}
