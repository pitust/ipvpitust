const dgram = require('dgram')
const sock = dgram.createSocket('udp4')
sock.bind(1234)
sock.on('message', (msg, rinfo) => {
    const msgs = msg.toString()
    console.log('%o %o', rinfo, msgs)
    if (msgs == 'What is this port?') sock.send(`${rinfo.port}`, rinfo.port, rinfo.address)
})
