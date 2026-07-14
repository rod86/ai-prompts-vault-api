export default interface TokenVerifierInterface {
    verifyToken(token: string): Promise<{ userId: string }>;
}
