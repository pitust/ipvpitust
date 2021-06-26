import { connect } from 'net'
import { createSocket, Socket } from 'dgram'
import { question } from 'readline-sync'
import { SmartBuffer } from 'smart-buffer'
import { Gateway, IGateway } from './IGateway'
import { getNatHoleHost, getNatHoleNote } from '../cli'
import { debug, info } from '../log'
import fetch from 'node-fetch'
import { handlePacket } from '../client'

// udp2p gateway
@Gateway('udp2p')
export class UDPPeerToPeerGateway implements IGateway {
    get canSend(): boolean {
        return true
    }
    _udpsock: Socket = createSocket('udp4')
    _uri: string | null = null
    get isAvailable(): boolean {
        return this._uri !== null
    }
    enable(): void {
        const { hostname, port } = new URL('blah://' + getNatHoleHost())
        this._udpsock.send(getNatHoleNote(), +port, hostname)
        this._udpsock.once('message', async portRaw => {
            const natPunchedPort = +portRaw.toString()
            debug(`NAT punched port: ${this._udpsock.address().port} is ${natPunchedPort}`)
            const ip = await fetch('http://ifconfig.me/ip').then(e => e.text())
            this._uri = `udp2p://${ip}:${natPunchedPort}`
            info(`Backend udp2p ready!`)
            this._udpsock.on('message', data => {
                info(`Packet: ${data.toString('hex')}`)
                handlePacket(new SmartBuffer({ buff: data }))
            })
        })
    }
    selfURI(): string {
        return this._uri
    }
    sendTo(uri: string, message: Buffer): void {
        const url = new URL(uri)
        if (url.protocol != 'udp2p:')
            throw new Error('assertion failed: UDPPeerToPeerGateway.sendTo expects a udp2p protocol URI')
        this._udpsock.send(message, +url.port, url.hostname)
        console.log({ message: message.toString('hex'), port: +url.port, host: url.hostname })
    }
}
