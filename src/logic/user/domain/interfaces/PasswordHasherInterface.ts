export default interface PasswordHasherInterface {
    hash(password: string): Promise<string>;
}
