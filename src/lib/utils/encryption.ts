/**
 * Encryption utility using Web Crypto API (AES-GCM)
 * Used for encrypting sensitive message updates
 */

// In a real app, this key should be rotated and managed securely.
// For this MVP improvement, we'll derive a key from a constant.
const ENCRYPTION_KEY_MATERIAL = 'delviery-marketplace-secure-key-v1';

async function getKey() {
    const encoder = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        encoder.encode(ENCRYPTION_KEY_MATERIAL),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );

    return window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: encoder.encode('salt-should-be-random-but-fixed-for-recovery'),
            iterations: 100000,
            hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

export async function encryptMessage(text: string): Promise<string> {
    try {
        const key = await getKey();
        const encoder = new TextEncoder();
        const data = encoder.encode(text);

        // IV must be unique for every encryption
        const iv = window.crypto.getRandomValues(new Uint8Array(12));

        const encrypted = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            data
        );

        // Combine IV and encrypted data for storage
        const encryptedArray = new Uint8Array(encrypted);
        const combined = new Uint8Array(iv.length + encryptedArray.length);
        combined.set(iv);
        combined.set(encryptedArray, iv.length);

        // Convert to Base64 for string storage
        return btoa(String.fromCharCode(...combined));
    } catch (error) {
        console.error('Encryption failed:', error);
        throw new Error('Failed to encrypt message');
    }
}

export async function decryptMessage(encryptedText: string): Promise<string> {
    try {
        const key = await getKey();

        // Decode Base64
        const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));

        // Extract IV (first 12 bytes) and data
        const iv = combined.slice(0, 12);
        const data = combined.slice(12);

        const decrypted = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            data
        );

        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    } catch (error) {
        console.error('Decryption failed:', error);
        // Return original text if decryption fails (fallback for unencrypted legacy data)
        return encryptedText;
    }
}
