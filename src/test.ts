import nacl from 'tweetnacl'
const kp = nacl.sign.keyPair()
console.log(kp.publicKey)
console.log(kp.secretKey.slice(32))
console.log(nacl.secretbox(Buffer.from('aaaa'), nacl.randomBytes(24), kp.publicKey))
