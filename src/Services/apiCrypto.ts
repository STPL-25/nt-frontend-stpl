/**
 * API Payload Encryption/Decryption
 *
 * Uses AES-256-GCM (hardware-accelerated, authenticated encryption).
 * The key is derived ONCE via PBKDF2 and cached for the browser session —
 * no per-request key derivation overhead.
 *
 * Must stay in sync with backend/src/Middleware/payloadCrypto.js
 */

const SALT = import.meta.env.VITE_CRYPTO_SALT as string;
let _cachedKey: CryptoKey | null = null;

async function getApiKey(): Promise<CryptoKey> {
  if (_cachedKey) return _cachedKey;

  const secret = import.meta.env.VITE_CRYPTO_SECRET as string;
  const encoder = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  _cachedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(SALT),
      iterations: 1000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return _cachedKey;
}

/**
 * Encrypt any JSON-serialisable value.
 * Returns { d: base64(ciphertext+authTag), iv: base64(12-byte-iv) }
 *
 * Web Crypto AES-GCM automatically appends the 16-byte auth tag to
 * the ciphertext — the backend expects this concatenated layout.
 */
export async function encryptPayload(data: unknown): Promise<{ d: string; iv: string }> {
  const key = await getApiKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(data));

  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  return {
    d: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

/**
 * Decrypt a { d, iv } payload produced by the backend (or encryptPayload).
 */
export async function decryptPayload(payload: { d: string; iv: string }): Promise<unknown> {
  const key = await getApiKey();
  const iv = Uint8Array.from(atob(payload.iv), (c) => c.charCodeAt(0));
  // d contains ciphertext + 16-byte auth tag concatenated (Web Crypto native format)
  const data = Uint8Array.from(atob(payload.d), (c) => c.charCodeAt(0));

  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return JSON.parse(new TextDecoder().decode(decrypted));
}
