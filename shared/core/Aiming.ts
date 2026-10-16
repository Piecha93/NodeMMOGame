export interface ProjectileAim {
    position: [number, number];
    rotation: number;
}

/** Domain positions are body centres. Keep the muzzle inside the body instead of skipping nearby cover. */
export function projectileAim(
    center: readonly [number, number],
    target: readonly [number, number],
    size: readonly [number, number],
): ProjectileAim | null {
    if (![...center, ...target, ...size].every(Number.isFinite)) return null;
    const dx = target[0] - center[0];
    const dy = target[1] - center[1];
    const distance = Math.hypot(dx, dy);
    if (distance < 1e-6) return null;
    const muzzleOffset = Math.min(4, Math.max(0, Math.min(size[0], size[1])) * 0.125, distance / 2);
    return {
        position: [center[0] + (dx / distance) * muzzleOffset, center[1] + (dy / distance) * muzzleOffset],
        rotation: Math.atan2(dy, dx),
    };
}
