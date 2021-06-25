import binascii
from sys import argv
import requests
import random
import socket
from scapy.all import *
from scapy.all import DNS, IP, UDP, DNSRR
import threading
import json
mode = input('[?] dnsbounce: mode [Send/Recieve/Gateway] ')
G_CASTER = '8.8.8.8'

myip = requests.get('http://ifconfig.me').text

sock = socket.socket(socket.AddressFamily.AF_INET,
                     socket.SocketKind.SOCK_DGRAM)


def ask_dnsbounceport():
    global sock
    sock.connect(('ipvpitust-nathole-port.pitust.dev', 1234))
    sock.send(b'What is this port?')
    return int(sock.recv(4096).decode())


def recv_drain(pkt):
    if DNS not in pkt:
        return
    if pkt[DNS].an:
        for i in pkt[DNS].an:
            try:
                print(i.rrname, i.rdata)
            except AttributeError:
                pass
    return pkt


def dnscast(sport, caster, data):
    send(IP(src="37.228.231.66", dst=caster)/UDP(sport=sport, dport=53) /
         DNS(an=DNSRR(rrname='ipvpitust-txt-dummy.pitust.dev.', type='TXT', rdata=data)))


def sendonport(sport, resolveserver):
    send(IP(src="37.228.231.66", dst=resolveserver) /
         UDP(sport=sport, dport=1234)/Raw('This is the target msg'))


def dnscastto(tgd, sport, caster, data):
    send(IP(src=tgd, dst=caster)/UDP(sport=sport, dport=53) /
         DNS(an=DNSRR(rrname='ipvpitust-txt-dummy.pitust.dev.', type='TXT', rdata=data)))


while mode not in ['s', 'r', 'g']:
    print(f'Invalid mode {mode}, try again')
    mode = input('[?] dnsbounce: mode [Send/Recieve] ')
if mode == 's':
    print('Sending...')
    payload = input('[?] dnsbounce: payload > ')
    ipaddr = input('[?] dnsbounce: target ip > ')
    ipp = ipaddr.split(':')
    dnscastto(ipp[0], int(ipp[1]), G_CASTER, payload.encode())
if mode == 'g':
    print('Setting up a gateway...')
    caster = socket.socket(socket.AddressFamily.AF_INET, socket.SocketKind.SOCK_STREAM)
    gport = int(argv[1]) if len(argv) > 1 else 1337
    print(f'[+] Gateway listening of port {gport}')
    caster.bind(('0.0.0.0', gport))
    caster.listen()
    gatewaysock, addr = caster.accept()
    def sockcast(pkt):
        global gatewaysock
        if DNS not in pkt:
            return
        if pkt[DNS].an:
            for i in pkt[DNS].an:
                try:
                    if i.rrname == b'ipvpitust-txt-dummy.pitust.dev.':
                        print(i.rdata)
                        for e in i.rdata:
                            gatewaysock.send(e)
                except AttributeError:
                    pass
        return pkt

    print('[+] Preparing port for dnsbounce remotes...')
    print(f'[+] dnscast: resolve the target via ipvpitust-dnsbounce-port.pitust.dev')
    rport = ask_dnsbounceport()
    print(f'[+] dnscast: got postnat port: {rport}')
    print(f'[+] dnscast: dnscast address: {myip}:{rport}')
    gatewaysock.send(f'{myip}:{rport}'.encode())
    source = SniffSource(iface=conf.iface)
    source > TransformDrain(sockcast)
    pe = PipeEngine(source)

    pe.start()

    thr = Thread(None, pe.wait_and_stop, 'recv_thread')
    thr.start()

    while True:
        data, _, _, _ = gatewaysock.recvmsg(0x4000)
        print(data)
        meta = data[0:64].decode()
        print(meta)
        obj = json.loads(meta)
        print('meta: ', meta)
        if obj["type"] == "quit":
            sys.exit(obj["code"])
        elif obj["type"] == "send":
            dnscastto(obj["ip"], obj["port"], G_CASTER, data[64:])
        else:
            print("Invalid packet recieved over control gateway:", obj)
            sys.exit(1)
if mode == 'r':
    print('Recieving...')
    print('[+] Preparing port for dnsbounce remotes...')
    print(f'[+] dnscast: resolve the target via ipvpitust-dnsbounce-port.pitust.dev')
    rport = ask_dnsbounceport()
    print(f'[+] dnscast: got address: {myip}:{rport}')
    source = SniffSource(iface=conf.iface)
    source > TransformDrain(recv_drain)
    pe = PipeEngine(source)
    pe.start()
    pe.wait_and_stop()
