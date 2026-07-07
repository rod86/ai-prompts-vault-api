export default interface AuthCryptoInterface {
    issueToken(userId: string, expiresAt: Date): Promise<string>;
    verifyPassword(password: string, passwordHash: string): Promise<boolean>;
}
