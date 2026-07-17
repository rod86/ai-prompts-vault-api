export default interface PasswordStrengthCheckerInterface {
    isStrong(password: string): boolean;
}
