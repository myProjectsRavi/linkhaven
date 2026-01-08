// LinkHaven - Client-Side Encryption using Web Crypto API
// Zero dependencies, uses native browser APIs
// PBKDF2 for key derivation, AES-GCM for encryption

const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const ITERATIONS = 600_000; // OWASP 2025 minimum for PBKDF2-HMAC-SHA256

/**
 * Generate a random salt for key derivation
 */
export function generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

/**
 * Convert Uint8Array to base64 string for storage
 */
export function arrayToBase64(arr: Uint8Array): string {
    return btoa(String.fromCharCode(...arr));
}

/**
 * Convert base64 string back to Uint8Array
 */
export function base64ToArray(base64: string): Uint8Array {
    const binary = atob(base64);
    const arr = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        arr[i] = binary.charCodeAt(i);
    }
    return arr;
}

/**
 * Derive an AES-GCM key from PIN using PBKDF2
 * Time complexity: O(iterations) - constant for fixed iteration count
 * Space complexity: O(1)
 */
export async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(pin),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );

    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt as BufferSource,
            iterations: ITERATIONS,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

/**
 * Encrypt plaintext data using AES-GCM
 * Returns: base64(iv + ciphertext)
 * Time complexity: O(n) where n is data length
 * Space complexity: O(n)
 */
export async function encrypt(data: string, key: CryptoKey): Promise<string> {
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoder.encode(data)
    );

    // Combine IV and ciphertext
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);

    return arrayToBase64(combined);
}

/**
 * Decrypt ciphertext using AES-GCM
 * Input: base64(iv + ciphertext)
 * Time complexity: O(n) where n is data length
 * Space complexity: O(n)
 */
export async function decrypt(encryptedData: string, key: CryptoKey): Promise<string> {
    const combined = base64ToArray(encryptedData);
    const iv = combined.slice(0, IV_LENGTH);
    const ciphertext = combined.slice(IV_LENGTH);

    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
}

/**
 * Check if encryption is available (Web Crypto API support)
 */
export function isEncryptionSupported(): boolean {
    return typeof crypto !== 'undefined' &&
        typeof crypto.subtle !== 'undefined' &&
        typeof crypto.subtle.deriveKey === 'function';
}

// Canary string for PIN verification (never store the actual PIN!)
const CANARY_STRING = 'LINKHAVEN_VERIFIED_2025';

/**
 * Create an encrypted canary for PIN verification
 * This allows verifying the PIN without storing it in plain text
 */
export async function createVerificationCanary(key: CryptoKey): Promise<string> {
    return encrypt(CANARY_STRING, key);
}

/**
 * Verify PIN by attempting to decrypt the canary
 * Returns true if the PIN is correct, false otherwise
 */
export async function verifyPinWithCanary(
    encryptedCanary: string,
    key: CryptoKey
): Promise<boolean> {
    try {
        const decrypted = await decrypt(encryptedCanary, key);
        return decrypted === CANARY_STRING;
    } catch (e) {
        // Decryption failed = wrong PIN
        return false;
    }
}
