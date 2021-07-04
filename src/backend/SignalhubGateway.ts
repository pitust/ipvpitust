import { args, getSignalhubServers } from '../cli'
import { Gateway, IGateway } from './IGateway'
import * as signalhub from 'signalhub'
import { randomBytes } from 'crypto'
import { info } from '../log'
import { SmartBuffer } from 'smart-buffer'
import { handlePacket } from '../client'

interface SignalhubMessage {
    message: { payload: string }
}

const gid = randomBytes(4).readUInt32LE(0).toString(16)

@Gateway('signalhub+http')
@Gateway('signalhub+https')
@Gateway('signalhub')
export class SignalhubGateway implements IGateway {
    defaultHub: string | null = null
    hub: signalhub.Hub<SignalhubMessage> | null = null
    get isAvailable(): boolean {
        return this.hub != null
    }
    get canSend(): boolean {
        return true
    }
    enable(): void {
        info(`Enabling!`)
        const servers = getSignalhubServers()
        this.hub = signalhub<SignalhubMessage>('ipvp', servers)
        this.hub.subscribe('message-' + gid).on('data', ({ payload }) => {
            handlePacket(new SmartBuffer({ buff: Buffer.from(payload, 'base64') }))
        })
        console.log('channel:', 'message-' + gid)
        this.defaultHub = servers[~~(Math.random() * servers.length)]
    }
    selfURI(): string {
        return `signalhub+${this.defaultHub}/${gid}`
    }
    sendTo(uri: string, message: Buffer): void {
        const url = new URL(uri)
        if (!['signalhub+http:', 'signalhub+https:'].includes(url.protocol))
            throw new Error(
                'assertion failed: SignalhubGateway.sendTo expects a signalhub+{http,https} protocol URI | is ' +
                    url.protocol
            )
        const hub = signalhub<SignalhubMessage>('ipvp', [
            url.protocol.slice(10) + '//' + url.hostname + (url.port ? ':' + url.port : ''),
        ])
        console.log(url.protocol.slice(10) + '//' + url.hostname)
        console.log('channel: ', 'message-' + url.pathname.slice(1))
        hub.broadcast('message-' + url.pathname.slice(1), { payload: message.toString('base64') })
        hub.close()
    }
}
