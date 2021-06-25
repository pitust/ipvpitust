import { randomBytes } from 'crypto'
import { SmartBuffer } from 'smart-buffer'
import * as nacl from 'tweetnacl'

export const PacketType = {
    QUERY_PEERSET: 0x56c4b5cf592282ean,
    MASS_PEERSET_INFO: 0xf1461a867bfacaf8n,
    NEW_PEER: 0x7da2659f94606468n,
    JUST_DATA: 0xa177a033bde96531n,
}

export const launchid = Buffer.from(nacl.randomBytes(8)).readBigUInt64LE(0)

export class Peer {
    constructor(public sodiumKey: Buffer, public ipsignature: Buffer, public uri: string, public launchid: bigint) {
        this.verify()
    }
    verify() {
        if (!nacl.sign.detached.verify(Buffer.from(this.uri), this.ipsignature, this.sodiumKey)) {
            throw new Error('Peer verification failed')
        }
    }
}

export abstract class PacketFactory {
    static new(id: bigint): SmartBuffer {
        const payload = new SmartBuffer()
        payload.writeBigUInt64LE(id)
        payload.writeBigUInt64LE(launchid)
        return payload
    }
    static queryPeerset(): SmartBuffer {
        const payload = PacketFactory.new(PacketType.QUERY_PEERSET)
        return payload
    }
    static massPeersetInfo(peers: Peer[]): SmartBuffer {
        const payload = PacketFactory.new(PacketType.MASS_PEERSET_INFO)
        payload.writeUInt32LE(peers.length)
        for (const peer of peers) {
            payload.writeBuffer(peer.sodiumKey)
            payload.writeBuffer(peer.ipsignature)
            payload.writeStringNT(peer.uri)
            payload.writeBigUInt64LE(peer.launchid)
        }
        return payload
    }
    static newPeer(peer: Peer): SmartBuffer {
        const payload = PacketFactory.new(PacketType.NEW_PEER)
        payload.writeBuffer(peer.sodiumKey)
        payload.writeBuffer(peer.ipsignature)
        payload.writeStringNT(peer.uri)
        payload.writeBigUInt64LE(peer.launchid)
        return payload
    }
    static newJustDataPacket(target: Peer, data: Buffer, selfkey: nacl.SignKeyPair): SmartBuffer {
        const payload = PacketFactory.new(PacketType.JUST_DATA)
        const nonce = randomBytes(24)
        payload.writeBuffer(target.sodiumKey)
        payload.writeBuffer(Buffer.from(selfkey.publicKey))
        payload.writeBuffer(nonce)
        payload.writeBuffer(Buffer.from(nacl.box(data, nonce, target.sodiumKey, selfkey.secretKey.slice(0, 32))))
        return payload
    }
}
export abstract class PacketParser {
    static parseQueryPeerset(_buf: SmartBuffer): {} {
        return {}
    }
    static parsePeer(buf: SmartBuffer): Peer {
        return new Peer(buf.readBuffer(32), buf.readBuffer(64), buf.readStringNT(), buf.readBigUInt64LE())
    }
    static parseNewPeer(buf: SmartBuffer): Peer {
        return PacketParser.parsePeer(buf)
    }
    static parseMassPeersetInfo(buf: SmartBuffer): Peer[] {
        const max = buf.readUInt32LE()
        const arr: Peer[] = []
        for (let i = 0; i < max; i++) {
            arr.push(PacketParser.parsePeer(buf))
        }
        return arr
    }
    static parseJustData(data: SmartBuffer, self: Peer, selfkey: nacl.SignKeyPair) {
        const pk = data.readBuffer(32)
        if (self.sodiumKey.equals(pk)) {
            const nonce = data.readBuffer(24)
            const sender = data.readBuffer(32)
            const payload = data.readBuffer()
            return nacl.box.open(payload, nonce, sender, selfkey.secretKey.slice(0, 32))
        } else {
            return null
        }
    }
}
