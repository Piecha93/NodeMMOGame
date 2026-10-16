export interface MovementState {
    x: number;
    y: number;
    velocity: number;
    horizontal: number;
    vertical: number;
}

export function movementFactors(horizontal: number, vertical: number): [number, number] {
    const speed = horizontal !== 0 && vertical !== 0 ? 0.7071 : 1;
    return [speed * vertical, speed * horizontal];
}

/** The same integration rule is used by authority, prediction and replay. */
export function integrateMovement(state: MovementState, deltaMs: number): [number, number] {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) throw new RangeError("Invalid movement delta");
    const [x, y] = movementFactors(state.horizontal, state.vertical);
    return [state.x + x * state.velocity * deltaMs, state.y + y * state.velocity * deltaMs];
}
