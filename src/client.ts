import { Completer, createInterface } from 'readline'
import { SmartBuffer } from 'smart-buffer'
import { launchid, PacketFactory, PacketParser, PacketType, Peer } from './packet'
import * as nacl from 'tweetnacl'
import { sendTo } from './backend'
import { args, loadKeys } from './cli'
import { gateways } from './backend/IGateway'

import './backend/DNSBounceGateway'
import './backend/UDPPeerToPeerGateway'
import { info } from './log'

const keypair = loadKeys()
const pool = new Map<string, Peer>()
const selfpeerid = Buffer.from(keypair.publicKey).toString('hex')
let selfpeer = new Peer(
    Buffer.from(keypair.publicKey),
    Buffer.from(nacl.sign.detached(Buffer.from(`ipvp-dummy://${selfpeerid}`), keypair.secretKey)),
    `ipvp-dummy://${selfpeerid}`,
    launchid
)
pool.set(Buffer.from(keypair.publicKey).toString('hex'), selfpeer)
function queryByLaunchid(tlaunchid: bigint): Peer {
    for (let [, peer] of pool) {
        if (peer.launchid == tlaunchid) return peer
    }
}
function createSelfpeer(gw: string) {
    selfpeer = new Peer(
        Buffer.from(keypair.publicKey),
        Buffer.from(nacl.sign.detached(Buffer.from(gateways.get(gw).selfURI()), keypair.secretKey)),
        gateways.get(gw).selfURI(),
        launchid
    )
    pool.set(Buffer.from(keypair.publicKey).toString('hex'), selfpeer)
    for (let peer of pool.values()) {
        if (peer != selfpeer) {
            sendTo(peer.uri, PacketFactory.newPeer(selfpeer).toBuffer())
        }
    }
}
export function handlePacket(b: SmartBuffer) {
    console.log(b.toBuffer())
    const packetid = b.readBigUInt64LE()
    const tlaunchid = b.readBigUInt64LE()
    if (tlaunchid == launchid) return
    rl.pause()
    console.log('Packet from', tlaunchid.toString(16), 'id =', packetid.toString(16))
    rl.resume()
    if (packetid == PacketType.QUERY_PEERSET) {
        const peer = queryByLaunchid(tlaunchid)
        sendTo(peer.uri, PacketFactory.massPeersetInfo([...pool.values()]).toBuffer())
        return
    }
    if (packetid == PacketType.NEW_PEER) {
        const peer = PacketParser.parseNewPeer(b)
        pool.set(peer.sodiumKey.toString('hex'), peer)
        return
    }
    if (packetid == PacketType.MASS_PEERSET_INFO) {
        const peers = PacketParser.parseMassPeersetInfo(b)
        for (const peer of peers) {
            pool.set(peer.sodiumKey.toString('hex'), peer)
        }
        return
    }
    if (packetid == PacketType.JUST_DATA) {
        const u8a = PacketParser.parseJustData(b, selfpeer, keypair)
        if (!u8a) return
        rl.pause()
        console.log('Recieved: %o', Buffer.from(u8a).toString())
        console.log(' NOTE: recieved from 0x%s', tlaunchid.toString(16))
        rl.resume()
    }
    rl.pause()
    console.log(`Unknown packet 0x${packetid.toString(16)}`)
    process.exit()
}

function validCommands(): string[] {
    return [
        'info backend',
        'info self',
        'dnscast peer',
        'tell',
        'pool',
        'clear',
        ...[...gateways.entries()].filter(e => !e[1].isAvailable).map(e => `backendctl up ${e[0]}`),
        ...[...gateways.entries()].filter(e => e[1].isAvailable).map(e => `backendctl select ${e[0]}`)
    ]
}

const rl = createInterface(process.stdin, process.stdout, <Completer>((line: string) => {
    const vcmd = validCommands().filter(e => e.startsWith(line))
    return [vcmd, line]
}))
function printPeer(peer: Peer) {
    console.log(` == Stats for peer [${peer.sodiumKey.toString('hex').slice(0, 16)}] == `)
    console.log(`ID (hex): ${peer.sodiumKey.toString('hex')}`)
    console.log(`ShortID: [${peer.sodiumKey.toString('hex').slice(0, 16)}]`)
    console.log(`Base64 ID: ${peer.sodiumKey.toString('base64')}`)
    console.log(`LaunchID: 0x${peer.launchid.toString(16)}`)
    console.log(`Gateway address: ${peer.uri}`)
}
if (args['default-backend']) {
    gateways.get(args['default-backend']).enable()
    const id = setInterval(() => {
        if (gateways.get(args['default-backend']).isAvailable) {
            info(`Backend ${args['default-backend']} up`)
            createSelfpeer(args['default-backend'])
            clearInterval(id)
        }
    }, 100)
}
rl.setPrompt('> ')
rl.prompt()
rl.on('line', answer => {
    if (answer.startsWith('dnscast peer ')) {
        const peer = answer.slice(13)
        sendTo(peer, PacketFactory.newPeer(selfpeer).toBuffer())
        sendTo(peer, PacketFactory.queryPeerset().toBuffer())
        console.log('OK')
        return rl.prompt()
    }
    if (answer.startsWith('tell ')) {
        const args = answer.slice(5)
        let [tgdpeer, ...msgparts] = args.split(' ')
        const peer = pool.get(tgdpeer)
        sendTo(peer.uri, PacketFactory.newJustDataPacket(peer, Buffer.from(msgparts.join(' ')), keypair).toBuffer())
        return rl.prompt()
    }
    if (answer == 'clear') {
        process.stdout.write('\x1b[H\x1b[2J')
        return rl.prompt()
    }
    if (answer == 'info backend') {
        console.log(' === Backends ===')
        let strmaxlen = 0
        for (let [bname, gateway] of gateways) {
            strmaxlen = Math.max(bname.length, strmaxlen)
        }
        for (let [bname, gateway] of gateways) {
            console.log(`${bname.padEnd(strmaxlen, ' ')}   ${gateway.isAvailable ? gateway.selfURI() : '<disabled>'}`)
        }
        return rl.prompt()
    }
    if (answer == 'info self') {
        printPeer(selfpeer)
        return rl.prompt()
    }
    if (answer.startsWith('backendctl ')) {
        answer = answer.slice(11)
        if (answer.startsWith('up ')) {
            answer = answer.slice(3)
            gateways.get(answer).enable()
            console.log('OK')
            rl.prompt()
            return
        }
        if (answer.startsWith('select ')) {
            answer = answer.slice(7)
            createSelfpeer(answer)
            console.log('OK')
            rl.prompt()
            return
        }
        console.log('Unknown subcommand')
        rl.prompt()
        return
    }
    if (answer == 'pool') {
        for (let [peername, peer] of pool) {
            console.log(`Peer ${peername}: ${peer.uri} | 0x${peer.launchid.toString(16).padStart(16, '0')}`)
        }
        console.log('OK')
        return rl.prompt()
    }
    if (answer == 'quit') {
        process.exit()
    }
    if (answer) console.log('Unknown command')
    rl.prompt()
})
