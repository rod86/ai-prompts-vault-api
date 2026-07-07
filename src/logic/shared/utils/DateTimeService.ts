import type DateTimeInterface from '@logic/shared/utils/DateTimeInterface.js';

export class DateTimeService implements DateTimeInterface {
    public now(): Date {
        return new Date();
    }
}
