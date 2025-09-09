/**
 * Base62 encoding/decoding utility for URL shortener
 * Character set: [a-zA-Z0-9] = 62 characters
 * Used to convert numeric IDs to short alphanumeric strings
 */

const BASE62_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const BASE = 62;

/**
 * Encodes a number to Base62 string
 * @param num - The number to encode (must be positive integer)
 * @returns Base62 encoded string
 * @throws Error if input is not a positive integer
 */
export function encodeBase62(num: number): string {
    if (!Number.isInteger(num) || num < 0) {
        throw new Error('Input must be a non-negative integer');
    }

    if (num === 0) {
        return BASE62_CHARS[0];
    }

    let result = '';
    let value = num;

    while (value > 0) {
        result = BASE62_CHARS[value % BASE] + result;
        value = Math.floor(value / BASE);
    }

    return result;
}

/**
 * Decodes a Base62 string to number
 * @param str - The Base62 string to decode
 * @returns Decoded number
 * @throws Error if input contains invalid characters
 */
export function decodeBase62(str: string): number {
    if (!str || typeof str !== 'string') {
        throw new Error('Input must be a non-empty string');
    }

    let result = 0;
    const length = str.length;

    for (let i = 0; i < length; i++) {
        const char = str[i];
        const charIndex = BASE62_CHARS.indexOf(char);

        if (charIndex === -1) {
            throw new Error(`Invalid character '${char}' in Base62 string`);
        }

        result = result * BASE + charIndex;
    }

    return result;
}

/**
 * Validates if a string is a valid Base62 encoded string
 * @param str - String to validate
 * @returns true if valid Base62 string, false otherwise
 */
export function isValidBase62(str: string): boolean {
    if (!str || typeof str !== 'string') {
        return false;
    }

    return str.split('').every(char => BASE62_CHARS.includes(char));
}

/**
 * Generates a Base62 string of specified minimum length
 * Pads with leading 'a' characters if necessary
 * @param num - Number to encode
 * @param minLength - Minimum length of resulting string
 * @returns Base62 string with minimum length
 */
export function encodeBase62WithMinLength(num: number, minLength: number): string {
    const encoded = encodeBase62(num);

    if (encoded.length >= minLength) {
        return encoded;
    }

    // Pad with leading 'a' characters (represents 0 in Base62)
    const padding = 'a'.repeat(minLength - encoded.length);
    return padding + encoded;
}