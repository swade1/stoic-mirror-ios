import * as Crypto from 'expo-crypto';

// Derive a consistent encryption key from the user's ID
const deriveKey = async (userId: string): Promise<string> => {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    userId + 'stoic-mirror-v1',
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  return hash;
};

// XOR encryption — lightweight, sufficient for personal journal data
const xorEncrypt = (text: string, key: string): string => {
  const result = [];
  for (let i = 0; i < text.length; i++) {
    result.push(
      String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length))
    );
  }
  return btoa(unescape(encodeURIComponent(result.join(''))));
};

const xorDecrypt = (encoded: string, key: string): string => {
  try {
    const text = decodeURIComponent(escape(atob(encoded)));
    const result = [];
    for (let i = 0; i < text.length; i++) {
      result.push(
        String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length))
      );
    }
    return result.join('');
  } catch {
    return encoded; // Return as-is if not valid base64 (unencrypted legacy data)
  }
};

export const encryptConcern = async (concern: string, userId: string): Promise<string> => {
  const key = await deriveKey(userId);
  return xorEncrypt(concern, key);
};

export const decryptConcern = async (encrypted: string, userId: string): Promise<string> => {
  try {
    const key = await deriveKey(userId);
    return xorDecrypt(encrypted, key);
  } catch {
    return encrypted; // Fallback for unencrypted legacy data
  }
};
