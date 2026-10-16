export class LoginRateLimiter {
    private readonly windows = new Map<string, { startedAt: number; count: number }>();

    allow(ip: string, now: number = Date.now()): boolean {
        let window = this.windows.get(ip);
        if (!window || now < window.startedAt || now - window.startedAt >= 60_000) {
            if (this.windows.size >= 1024) {
                const oldest = this.windows.keys().next().value;
                if (oldest !== undefined) this.windows.delete(oldest);
            }
            window = { startedAt: now, count: 0 };
            this.windows.set(ip, window);
        }
        if (window.count >= 10) return false;
        window.count++;
        return true;
    }
}
