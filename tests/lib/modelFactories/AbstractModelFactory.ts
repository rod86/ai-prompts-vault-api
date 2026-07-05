export abstract class AbstractModelFactory<T> {
    createMany(count: number = 5, data: Partial<T> = {}): T[] {
        return Array.from({ length: count }, () => this.create(data));
    }

    abstract create(data?: Partial<T>): T;
}
