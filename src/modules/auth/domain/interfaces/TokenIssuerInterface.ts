export default interface TokenIssuerInterface {
    issueToken(userId: string, expiresAt: Date): Promise<string>;
}
