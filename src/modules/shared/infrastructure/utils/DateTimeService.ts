import type DateTimeInterface from '@src/modules/shared/domain/interfaces/DateTimeInterface.js';

export class DateTimeService implements DateTimeInterface {
    public now(): Date {
        return new Date();
    }
}
