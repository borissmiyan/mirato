export interface AuthResult {
    success: boolean;
    error?: string;
}

export class RemoteAuthManager {
    public currentPin = '0000';
    private authFailures: Map<string, { attempts: number; lockUntil: number }> = new Map();

    public generateNewPin(): string {
        this.currentPin = Math.floor(1000 + Math.random() * 9000).toString();
        return this.currentPin;
    }

    public validateAttempt(clientIp: string, pin: string): AuthResult {
        const now = Date.now();
        const record = this.authFailures.get(clientIp);

        if (record && record.lockUntil > now) {
            const waitSec = Math.ceil((record.lockUntil - now) / 1000);
            return {
                success: false,
                error: `Слишком много попыток. Блокировка на ${waitSec} сек.`
            };
        }

        if (pin === this.currentPin) {
            this.authFailures.delete(clientIp);
            return { success: true };
        }

        const attempts = (record ? record.attempts : 0) + 1;
        const lockUntil = attempts >= 5 ? now + 2 * 60 * 1000 : 0;
        this.authFailures.set(clientIp, { attempts, lockUntil });
        const error = attempts >= 5
            ? 'Слишком много неверных попыток. Повторите через 2 минуты.'
            : 'Invalid PIN';

        return { success: false, error };
    }

    public clear(): void {
        this.authFailures.clear();
    }
}

