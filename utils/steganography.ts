/**
 * Steganography - Hide encrypted data inside PNG images
 * 
 * ALGORITHM: LSB (Least Significant Bit) encoding
 * 1. Load carrier PNG into Canvas
 * 2. Convert encrypted data to binary
 * 3. Embed each bit into LSB of R/G/B channels (skip Alpha)
 * 4. Export as new PNG (visually identical)
 * 
 * CAPACITY: 
 * - Each pixel stores 3 bits (R, G, B LSBs)
 * - 1000x1000 image = 375KB data capacity
 * - 512x512 image = ~98KB data capacity
 * 
 * COMPLEXITY: O(n) where n = pixels
 * 
 * SECURITY:
 * - Data MUST be encrypted before embedding
 * - AES-GCM ciphertext is indistinguishable from noise
 * - Image appears completely normal to inspection
 * 
 * USE CASE: "Vacation Photo Vault"
 * - User exports backup as family photo
 * - Crosses border with innocent-looking image
 * - Imports photo back into LinkHaven to restore
 * 
 * ZERO DEPENDENCIES - Pure Canvas API
 */

// Magic header to identify LinkHaven stego images
const STEGO_MAGIC = new Uint8Array([0x4C, 0x48, 0x53, 0x54]); // "LHST"
const HEADER_SIZE = 4 + 4; // Magic (4 bytes) + Length (4 bytes)

/**
 * Convert Uint8Array to bit array
 */
function toBitArray(data: Uint8Array): number[] {
    const bits: number[] = [];
    for (const byte of data) {
        for (let i = 7; i >= 0; i--) {
            bits.push((byte >> i) & 1);
        }
    }
    return bits;
}

/**
 * Convert bit array back to Uint8Array
 */
function bitsToBytes(bits: number[]): Uint8Array {
    const bytes = new Uint8Array(Math.ceil(bits.length / 8));
    for (let i = 0; i < bits.length; i += 8) {
        let byte = 0;
        for (let j = 0; j < 8 && i + j < bits.length; j++) {
            byte = (byte << 1) | bits[i + j];
        }
        bytes[i / 8] = byte;
    }
    return bytes;
}

/**
 * Convert 32-bit number to bit array
 */
function numberToBits(n: number): number[] {
    const bits: number[] = [];
    for (let i = 31; i >= 0; i--) {
        bits.push((n >> i) & 1);
    }
    return bits;
}

/**
 * Convert bit array to 32-bit number
 */
function bitsToNumber(bits: number[]): number {
    let n = 0;
    for (let i = 0; i < 32 && i < bits.length; i++) {
        n = (n << 1) | bits[i];
    }
    return n >>> 0; // Ensure unsigned
}

/**
 * Calculate maximum data capacity for an image
 * @param width Image width in pixels
 * @param height Image height in pixels
 * @returns Maximum bytes that can be hidden
 */
export function calculateCapacity(width: number, height: number): number {
    const totalPixels = width * height;
    const bitsAvailable = totalPixels * 3; // 3 bits per pixel (R, G, B)
    const bytesAvailable = Math.floor(bitsAvailable / 8);
    return bytesAvailable - HEADER_SIZE; // Reserve space for header
}

/**
 * Hide encrypted data inside an image using LSB steganography
 * 
 * @param carrierCanvas Canvas with the carrier image loaded
 * @param encryptedData The encrypted data to hide (must be AES-GCM ciphertext)
 * @returns New canvas with hidden data, or null if data too large
 */
export function hideDataInImage(
    carrierCanvas: HTMLCanvasElement,
    encryptedData: Uint8Array
): HTMLCanvasElement | null {
    const ctx = carrierCanvas.getContext('2d');
    if (!ctx) return null;

    const width = carrierCanvas.width;
    const height = carrierCanvas.height;
    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    // Check capacity
    const capacity = calculateCapacity(width, height);
    if (encryptedData.length > capacity) {
        console.error(`Data (${encryptedData.length} bytes) exceeds capacity (${capacity} bytes)`);
        return null;
    }

    // Build header: Magic + Length
    const header = new Uint8Array(HEADER_SIZE);
    header.set(STEGO_MAGIC, 0);
    new DataView(header.buffer).setUint32(4, encryptedData.length, false); // Big-endian

    // Combine header + data
    const fullData = new Uint8Array(HEADER_SIZE + encryptedData.length);
    fullData.set(header, 0);
    fullData.set(encryptedData, HEADER_SIZE);

    // Convert to bits
    const dataBits = toBitArray(fullData);

    // Embed bits into LSB of R, G, B channels (skip Alpha)
    let bitIndex = 0;
    for (let i = 0; i < pixels.length && bitIndex < dataBits.length; i++) {
        // Skip alpha channel (every 4th byte: indices 3, 7, 11, ...)
        if ((i + 1) % 4 === 0) continue;

        // Clear LSB and set new bit
        pixels[i] = (pixels[i] & 0xFE) | dataBits[bitIndex++];
    }

    // Create output canvas
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = width;
    outputCanvas.height = height;
    const outputCtx = outputCanvas.getContext('2d')!;
    outputCtx.putImageData(imageData, 0, 0);

    return outputCanvas;
}

/**
 * Extract hidden data from a stego image
 * 
 * @param stegoCanvas Canvas with the stego image loaded
 * @returns Extracted encrypted data, or null if no hidden data found
 */
export function extractDataFromImage(
    stegoCanvas: HTMLCanvasElement
): Uint8Array | null {
    const ctx = stegoCanvas.getContext('2d');
    if (!ctx) return null;

    const width = stegoCanvas.width;
    const height = stegoCanvas.height;
    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    // Extract all LSBs from R, G, B channels
    const bits: number[] = [];
    for (let i = 0; i < pixels.length; i++) {
        if ((i + 1) % 4 === 0) continue; // Skip alpha
        bits.push(pixels[i] & 1);
    }

    // Read header (first 64 bits = 8 bytes)
    const headerBits = bits.slice(0, HEADER_SIZE * 8);
    const headerBytes = bitsToBytes(headerBits);

    // Verify magic header
    for (let i = 0; i < STEGO_MAGIC.length; i++) {
        if (headerBytes[i] !== STEGO_MAGIC[i]) {
            console.error('No LinkHaven steganographic data found in image');
            return null;
        }
    }

    // Read data length
    const dataLength = new DataView(headerBytes.buffer).getUint32(4, false);

    // Validate length
    const capacity = calculateCapacity(width, height);
    if (dataLength > capacity || dataLength <= 0) {
        console.error('Invalid data length in stego header');
        return null;
    }

    // Extract data bits
    const dataBits = bits.slice(HEADER_SIZE * 8, (HEADER_SIZE + dataLength) * 8);
    return bitsToBytes(dataBits);
}

/**
 * Load an image file into a canvas
 */
export function loadImageToCanvas(file: File): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(url);
            resolve(canvas);
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image'));
        };

        img.src = url;
    });
}

/**
 * Download canvas as PNG file
 */
export function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename: string): void {
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

/**
 * Create a default carrier image (gradient pattern)
 * Used when user doesn't provide their own image
 */
export function createDefaultCarrierImage(
    width: number = 1024,
    height: number = 768
): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // Create a pleasant gradient background
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(0.5, '#764ba2');
    gradient.addColorStop(1, '#66a6ff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Add some noise for better steganography cover
    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;
    for (let i = 0; i < pixels.length; i += 4) {
        // Add slight random variation to each channel
        pixels[i] = Math.max(0, Math.min(255, pixels[i] + Math.floor(Math.random() * 6) - 3));
        pixels[i + 1] = Math.max(0, Math.min(255, pixels[i + 1] + Math.floor(Math.random() * 6) - 3));
        pixels[i + 2] = Math.max(0, Math.min(255, pixels[i + 2] + Math.floor(Math.random() * 6) - 3));
    }
    ctx.putImageData(imageData, 0, 0);

    return canvas;
}
