/** Authenticated game endpoint, supplied by Socket.IO or an admitted worker bridge. */
export interface GameConnection {
    readonly request: unknown;
    readonly connected: boolean;
    /** Resolved by the trusted admission layer; absent on ordinary Socket.IO sockets. */
    readonly displayName?: string;
    compress(enabled: boolean): unknown;
    on(event: string, listener: (...args: unknown[]) => void): unknown;
    emit(event: string, ...args: unknown[]): unknown;
    disconnect(close?: boolean): unknown;
}

export interface GameTransport {
    on(event: "connection", listener: (connection: GameConnection) => void): unknown;
    off(event: "connection", listener: (connection: GameConnection) => void): unknown;
    emit(event: string, ...args: unknown[]): unknown;
}
