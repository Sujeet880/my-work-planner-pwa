// supabase/functions/_shared/crypto.ts
// Standard Web Crypto API AES-GCM 256-bit encryption / decryption

async function getCryptoKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.digest('SHA-256', enc.encode(secret));
  return crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts plaintext string using AES-GCM 256-bit with random 12-byte IV.
 * Returns Base64-encoded string containing [IV (12 bytes) + Ciphertext].
 */
export async function encryptToken(plaintext: string, secret: string): Promise<string> {
  if (!plaintext) return '';
  const key = await getCryptoKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );

  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  // Convert to Base64
  let binary = '';
  for (let i = 0; i < combined.byteLength; i++) {
    binary += String.fromCharCode(combined[i]);
  }
  return btoa(binary);
}

/**
 * Decrypts Base64-encoded string containing [IV (12 bytes) + Ciphertext].
 * Returns original plaintext string.
 */
export async function decryptToken(base64Ciphertext: string, secret: string): Promise<string> {
  if (!base64Ciphertext) return '';
  const key = await getCryptoKey(secret);
  const binary = atob(base64Ciphertext);
  const combined = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    combined[i] = binary.charCodeAt(i);
  }

  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Creates a signed/encrypted OAuth state token containing userId, nonce, and timestamp.
 */
export async function createOAuthState(userId: string, secret: string): Promise<string> {
  const payload = JSON.stringify({
    userId,
    nonce: crypto.randomUUID(),
    timestamp: Date.now(),
  });
  return encryptToken(payload, secret);
}

/**
 * Verifies and decodes an OAuth state token.
 * Validates expiration (max 15 minutes) and extracts userId.
 */
export async function verifyOAuthState(
  stateString: string,
  secret: string
): Promise<{ userId: string } | null> {
  try {
    const jsonStr = await decryptToken(stateString, secret);
    const parsed = JSON.parse(jsonStr);
    if (!parsed.userId || !parsed.timestamp) return null;

    // Check expiration: 15 minutes (900,000 ms)
    const elapsed = Date.now() - parsed.timestamp;
    if (elapsed < 0 || elapsed > 900000) {
      console.warn('OAuth state expired or timestamp invalid:', elapsed);
      return null;
    }

    return { userId: parsed.userId };
  } catch (err) {
    console.error('Failed to verify OAuth state:', err);
    return null;
  }
}
