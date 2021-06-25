import { connect, Socket } from 'net'
import { question } from 'readline-sync'
import { SmartBuffer } from 'smart-buffer'
import { handlePacket } from '../../client'
import { Gateway, IGateway } from './IGateway'

function send(sock: Socket, meta: any, payload: Buffer = Buffer.alloc(0)) {
    const str = JSON.stringify(meta).padEnd(64, ' ')
    if (str.length > 64) throw new Error('Unable to send, meta too long')
    const sb = new SmartBuffer()
    sb.writeString(str)
    sb.writeBuffer(payload)
    sock.write(sb.toBuffer())
}

// dnsbounce gateway
@Gateway('dnsbounce')
export class DNSBounceGateway implements IGateway {
    _uri: string = null
    _sock: Socket
    selfURI(): string {
        return this._uri
    }
    get isAvailable(): boolean {
        return this._uri !== null
    }
    enable(): void {
        const port = +question('[+] DNSBounceGateway: what is the ip/port of dnsbounce gateway? ')
        const sock = (this._sock = connect(port))
        sock.once('data', host => {
            this._uri = `dnsbounce://${host.toString()}`
            sock.on('data', data => {
                handlePacket(new SmartBuffer({ buff: data }))
            })
        })
    }
    sendTo(uri: string, message: Buffer): void {
        const url = new URL(uri)
        if (url.protocol != 'dnsbounce:')
            throw new Error('assertion failed: DNSBounceGateway.sendTo expects a dnsbounce protocol')
        send(this._sock, { type: 'send', ip: url.hostname, port: +url.port }, message)
    }
}
