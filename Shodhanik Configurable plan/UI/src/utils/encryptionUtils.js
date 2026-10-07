import CryptoJS from 'crypto-js';

// Use the same AES key as backend (from appsettings.json)
const AES_KEY_HEX = import.meta.env.VITE_AES_KEY_HEX;

// Convert hex key to WordArray (same as backend)
const key = CryptoJS.enc.Hex.parse(AES_KEY_HEX);

// Configuration flags from environment variables - 2 simple settings
export const encryptionConfig = {
  encryptRequests: import.meta.env.VITE_ENCRYPT_REQUESTS === 'true',
  encryptResponses: import.meta.env.VITE_ENCRYPT_RESPONSES === 'true'
};

export const encryptData = (data) => {
  try {
    const jsonString = JSON.stringify(data);
    
    // Generate random IV
    const iv = CryptoJS.lib.WordArray.random(16);
    
    // Encrypt with AES-256-CBC (same as backend)
    const encrypted = CryptoJS.AES.encrypt(jsonString, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    // Combine IV and encrypted data
    const combined = iv.concat(encrypted.ciphertext);
    
    return CryptoJS.enc.Base64.stringify(combined);
  } catch (error) {
    console.error('Encryption error:', error);
    return null;
  }
};

export const decryptData = (encryptedData) => {
  try {
    if (!encryptedData) return null;
    
    // If encryptedData is not a string, it's likely already decrypted/parsed data
    if (typeof encryptedData !== 'string') {
      console.warn('decryptData received non-string data, returning as-is:', typeof encryptedData);
      return encryptedData;
    }
    
    // Decode from base64
    const combined = CryptoJS.enc.Base64.parse(encryptedData);
    
    // Extract IV (first 16 bytes) and ciphertext
    const iv = CryptoJS.lib.WordArray.create(combined.words.slice(0, 4));
    const ciphertext = CryptoJS.lib.WordArray.create(combined.words.slice(4));
    
    // Decrypt
    const decrypted = CryptoJS.AES.decrypt(
      CryptoJS.lib.CipherParams.create({ ciphertext: ciphertext }),
      key,
      {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      }
    );
    
    const jsonString = decrypted.toString(CryptoJS.enc.Utf8);
    return jsonString ? JSON.parse(jsonString) : null;
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
};