/**
 * License Key Validation - Ed25519 Cryptographic Signatures
 * 
 * ARCHITECTURE:
 * 1. User pays via LemonSqueezy/Gumroad
 * 2. Webhook triggers Vercel Edge Function
 * 3. Edge Function creates & signs license payload
 * 4. User receives license key via email
 * 5. LinkHaven validates signature OFFLINE using public key
 * 
 * SECURITY:
 * - Ed25519 signatures are unforgeable without private key
 * - Public key is hardcoded in app (safe to expose)
 * - Offline validation = no API calls
 * - Accepts small risk of refund abuse (1-2%)
 * 
 * COMPLEXITY: O(1) verification
 * ZERO DEPENDENCIES - Native Web Crypto API (Ed25519)
 */

// License storage keys
const LICENSE_KEYS = {
    LICENSE_DATA: 'lh_license_data',
    LICENSE_VALIDATED: 'lh_license_validated',
} as const;

// Your Ed25519 public key (base64) - REPLACE with your actual key
// Generate using: openssl genpkey -algorithm Ed25519 -out private.pem
//                 openssl pkey -in private.pem -pubout -out public.pem
const PUBLIC_KEY_BASE64 = 'REPLACE_WITH_YOUR_ED25519_PUBLIC_KEY_BASE64';

export interface LicensePayload {
    email: string;
    expires: string;      // ISO 8601 date
    features: string[];   // ['pro']
    issued: string;       // ISO 8601 date
    tier: 'pro' | 'basic';
}

export interface LicenseStatus {
    valid: boolean;
    isPro: boolean;
    expiresAt: Date | null;
    email: string | null;
    error?: string;
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToArray(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * Convert Uint8Array to base64 string
 */
function arrayToBase64(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes));
}

/**
 * Verify a license key signature using Ed25519
 * 
 * License format: base64(payload).base64(signature)
 */
export async function verifyLicenseKey(licenseKey: string): Promise<LicenseStatus> {
    try {
        // Parse license key
        const parts = licenseKey.trim().split('.');
        if (parts.length !== 2) {
            return { valid: false, isPro: false, expiresAt: null, email: null, error: 'Invalid license format' };
        }

        const [payloadB64, signatureB64] = parts;

        // Decode payload
        let payload: LicensePayload;
        try {
            payload = JSON.parse(atob(payloadB64));
        } catch {
            return { valid: false, isPro: false, expiresAt: null, email: null, error: 'Invalid payload encoding' };
        }

        // Skip signature verification if public key not set (development mode)
        if (PUBLIC_KEY_BASE64 === 'REPLACE_WITH_YOUR_ED25519_PUBLIC_KEY_BASE64') {
            console.warn('License validation running in development mode (signature check skipped)');
        } else {
            // Import public key
            const publicKeyBytes = base64ToArray(PUBLIC_KEY_BASE64);
            const publicKey = await crypto.subtle.importKey(
                'raw',
                publicKeyBytes.buffer as ArrayBuffer,
                { name: 'Ed25519' },
                false,
                ['verify']
            );

            // Verify signature
            const signatureBytes = base64ToArray(signatureB64);
            const payloadBytes = new TextEncoder().encode(payloadB64);

            const isValid = await crypto.subtle.verify(
                { name: 'Ed25519' },
                publicKey,
                signatureBytes.buffer as ArrayBuffer,
                payloadBytes
            );

            if (!isValid) {
                return { valid: false, isPro: false, expiresAt: null, email: null, error: 'Invalid signature' };
            }
        }

        // Check expiry
        const expiresAt = new Date(payload.expires);
        if (expiresAt < new Date()) {
            return {
                valid: false,
                isPro: false,
                expiresAt,
                email: payload.email,
                error: 'License expired'
            };
        }

        // Valid license!
        return {
            valid: true,
            isPro: payload.features.includes('pro') || payload.tier === 'pro',
            expiresAt,
            email: payload.email,
        };
    } catch (e) {
        return {
            valid: false,
            isPro: false,
            expiresAt: null,
            email: null,
            error: `Verification failed: ${e instanceof Error ? e.message : 'Unknown error'}`
        };
    }
}

/**
 * Activate a license key and store it
 */
export async function activateLicense(licenseKey: string): Promise<LicenseStatus> {
    const status = await verifyLicenseKey(licenseKey);

    if (status.valid) {
        // Store license data
        localStorage.setItem(LICENSE_KEYS.LICENSE_DATA, licenseKey);
        localStorage.setItem(LICENSE_KEYS.LICENSE_VALIDATED, 'true');
    }

    return status;
}

/**
 * Get current license status
 */
export async function getLicenseStatus(): Promise<LicenseStatus> {
    const storedLicense = localStorage.getItem(LICENSE_KEYS.LICENSE_DATA);

    if (!storedLicense) {
        return { valid: false, isPro: false, expiresAt: null, email: null };
    }

    return verifyLicenseKey(storedLicense);
}

/**
 * Check if user has Pro features
 */
export async function isPro(): Promise<boolean> {
    const status = await getLicenseStatus();
    return status.valid && status.isPro;
}

/**
 * Deactivate current license
 */
export function deactivateLicense(): void {
    localStorage.removeItem(LICENSE_KEYS.LICENSE_DATA);
    localStorage.removeItem(LICENSE_KEYS.LICENSE_VALIDATED);
}

/**
 * Get days until license expiry
 */
export async function getDaysUntilExpiry(): Promise<number | null> {
    const status = await getLicenseStatus();
    if (!status.valid || !status.expiresAt) return null;

    const now = new Date();
    const diff = status.expiresAt.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
