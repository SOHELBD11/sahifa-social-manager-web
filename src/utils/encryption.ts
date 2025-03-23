import * as crypto from 'crypto';

// This should be stored in environment variables
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

if (!ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY environment variable is not set');
}

interface EncryptedData {
  encryptedData: string;
  iv: string;
  authTag: string;
}

export async function encrypt(text: string): Promise<string> {
  try {
    // Generate a random initialization vector
    const iv = crypto.randomBytes(12);
    
    // Create cipher
    const cipher = crypto.createCipheriv(
      ENCRYPTION_ALGORITHM,
      Buffer.from(ENCRYPTION_KEY, 'hex'),
      iv
    );

    // Encrypt the data
    let encryptedData = cipher.update(text, 'utf8', 'hex');
    encryptedData += cipher.final('hex');

    // Get the authentication tag
    const authTag = cipher.getAuthTag();

    // Combine the encrypted data with the IV and auth tag
    const result: EncryptedData = {
      encryptedData,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };

    // Return as a single string, with parts separated by a delimiter
    return Buffer.from(JSON.stringify(result)).toString('base64');
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

export async function decrypt(encryptedString: string): Promise<string> {
  try {
    // Parse the encrypted string
    const encryptedData: EncryptedData = JSON.parse(
      Buffer.from(encryptedString, 'base64').toString()
    );

    // Create decipher
    const decipher = crypto.createDecipheriv(
      ENCRYPTION_ALGORITHM,
      Buffer.from(ENCRYPTION_KEY, 'hex'),
      Buffer.from(encryptedData.iv, 'hex')
    );

    // Set the auth tag
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

    // Decrypt the data
    let decrypted = decipher.update(encryptedData.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
} 