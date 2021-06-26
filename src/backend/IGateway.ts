export const gateways = new Map<string, IGateway>()
export interface IGateway {
    get isAvailable(): boolean
    get canSend(): boolean
    enable(): void
    selfURI(): string
    sendTo(uri: string, message: Buffer): void
}
export function Gateway(name: string): <T extends new () => IGateway>(t: T) => T {
    return gateway => {
        gateways.set(name, new gateway())
        return gateway
    }
}
