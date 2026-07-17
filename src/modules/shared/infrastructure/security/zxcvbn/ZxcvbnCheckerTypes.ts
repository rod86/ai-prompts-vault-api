export interface ZxcvbnChecker {
    check(password: string): { score: number };
}

export interface ZxcvbnCheckerFactoryInterface {
    create(): ZxcvbnChecker;
}
