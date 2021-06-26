import { info } from '../log'
import { gateways } from './IGateway'

export function sendTo(url: string, msg: Buffer) {
    const urlobj = new URL(url)
    const gw = gateways.get(urlobj.protocol.slice(0, -1))!
    if (!gw) throw new Error(`Cannot communicate with ${url}: gateway not loaded`)
    if (!gw.canSend) throw new Error(`Cannot communicate with ${url}: gateway not available`)
    info(`Sending to ${url}: ${msg.toString('hex')}`)
    gw.sendTo(url, msg)
}
