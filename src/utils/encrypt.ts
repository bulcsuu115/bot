import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import { config } from './config';

function getEncryptionKey(): Uint8Array {
  const key = config.encryptionKey;
  if (key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
  }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(key.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function encryptPrivateKey(privateKeyHex: string): string {
  const key = getEncryptionKey();
  const data = new Uint8Array(privateKeyHex.length / 2);
  for (let i = 0; i < data.length; i++) {
    data[i] = parseInt(privateKeyHex.substring(i * 2, i * 2 + 2), 16);
  }
  const nonce = nacl.randomBytes(24);
  const encrypted = nacl.secretbox(data, nonce, key);
  if (!encrypted) throw new Error('Encryption failed');
  const combined = new Uint8Array(nonce.length + encrypted.length);
  combined.set(nonce);
  combined.set(encrypted, nonce.length);
  return encodeBase64(combined);
}

export function decryptPrivateKey(encryptedBase64: string): string {
  const key = getEncryptionKey();
  const combined = decodeBase64(encryptedBase64);
  const nonce = combined.slice(0, 24);
  const encrypted = combined.slice(24);
  const decrypted = nacl.secretbox.open(encrypted, nonce, key);
  if (!decrypted) throw new Error('Decryption failed - invalid key or corrupted data');
  return Array.from(decrypted)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
