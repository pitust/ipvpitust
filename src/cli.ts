import { existsSync, readFileSync, writeFileSync } from 'fs'
import * as parse from 'minimist'
import * as nacl from 'tweetnacl'
import { gateways } from './src/backend/IGateway'
import * as log from './log'

export const args = parse(process.argv.slice(2), {
    alias: {
        sport: 'p',
        help: 'h',
        verbose: 'v',
        key: 'k',
        peer: 'c',
        'nat-hole-host': 'H',
        'nat-hole-note': 'n',
        connect: 'c',
        'default-backend': 'b',
    },
})

if (args.help) {
    console.log(`Usage: ipvp-client [ARGS...]

    -p, --sport <port>              Map port to the IPvPITUST address
    -h, --help                      Show this message
    -v, --verbose                   Show debug logs
    -k, --key <key>                 Set the keyfile to use
    -c, --peer, --connect <peer>    Set the initial peer to connect to (default: udp2p://ipvpitust-gateway.pitust.dev:2345)
    -H, --nat-hole-host <host>      Set the NAT hole host (default: ipvpitust-nathole-port.pitust.dev:1234)
    -n, --nat-hole-note <note>      Set the NAT hole note (default: "What is this port?")
    -b, --default-backend <backend> Set the default IPvPITUST communication backend`)
    process.exit()
}

function getNatHoleHostInner(): string {
    if (args['nat-hole-host']) return args['nat-hole-host']
    return 'ipvpitust-nathole-port.pitust.dev:1234'
}
function getNatHoleNoteInner(): string {
    if (args['nat-hole-note']) return args['nat-hole-note']
    return 'What is this port?'
}
let ftnathole = true
export function getNatHoleHost(): string {
    if (ftnathole) {
        log.debug(`NAT hole host: ${getNatHoleHostInner()}`)
        log.debug(`NAT hole note: ${getNatHoleNoteInner()}`)
        ftnathole = false
    }
    return getNatHoleHostInner()
}
export function getNatHoleNote(): string {
    if (ftnathole) {
        log.debug(`NAT hole host: ${getNatHoleHostInner()}`)
        log.debug(`NAT hole note: ${getNatHoleNoteInner()}`)
        ftnathole = false
    }
    return getNatHoleNoteInner()
}

export function loadKeys(): nacl.SignKeyPair {
    if (!args.key || !existsSync(args.key)) {
        const sk = nacl.sign.keyPair()
        if (args.key) writeFileSync(args.key, sk.secretKey)
        return sk
    }
    return nacl.sign.keyPair.fromSecretKey(readFileSync(args.key))
}

export const defaultBackend: string = args['default-backend'] ?? (() => {
    for (let [scheme, gateway] of gateways) {
        if (args[scheme]) gateway.isAvailable
    }
})()