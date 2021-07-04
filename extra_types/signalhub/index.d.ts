// Type definitions for signalhub

import TypedEmitter from "typed-emitter"

export interface Hub<T extends {}> {
    broadcast<U extends string>(channel: U, value: T extends { [k in U]: infer V } ? V : any): void;
    subscribe<U extends string>(channel: U): TypedEmitter<{
        data(arg: T extends { [k in U]: infer V } ? V : any): void
    }>
    close(): void
}

export default function signalhub<T extends {} = {}>(appId: string, hubs: string[]): Hub<T>;