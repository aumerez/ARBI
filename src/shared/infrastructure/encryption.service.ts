import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly encryptionKey: Buffer;

  constructor(private readonly config: ConfigService) {
    const keyMaterial = this.config.get<string>('ENCRYPTION_KEY', '');
    if (!keyMaterial) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }

    // Derive a 32-byte key using scrypt (AES-256)
    this.encryptionKey = scryptSync(keyMaterial, 'salt', 32);
    this.logger.debug('Encryption key derived from ENCRYPTION_KEY');
  }

  /**
   * Encrypt plaintext using AES-256-GCM
   * Returns base64-encoded concatenation of IV (12 bytes) + authTag (16 bytes) + ciphertext
   */
  async encrypt(plaintext: string): Promise<string> {
    try {
      // Generate random 96-bit (12-byte) IV for GCM
      const iv = randomBytes(12);

      // Create cipher with AES-256-GCM
      const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);

      // Encrypt the data
      let ciphertext = cipher.update(plaintext, 'utf8', 'binary');
      ciphertext += cipher.final('binary');

      // Get authentication tag
      const authTag = cipher.getAuthTag();

      // Concatenate: IV + authTag + ciphertext
      const combined = Buffer.concat([iv, authTag, Buffer.from(ciphertext, 'binary')]);

      // Return base64 encoded
      return combined.toString('base64');
    } catch (error) {
      this.logger.error('Encryption failed', error);
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  /**
   * Decrypt ciphertext (base64-encoded IV + authTag + ciphertext) back to plaintext
   */
  async decrypt(ciphertext: string): Promise<string> {
    try {
      // Decode base64
      const combined = Buffer.from(ciphertext, 'base64');

      // Extract IV (first 12 bytes), authTag (next 16 bytes), and ciphertext (rest)
      const iv = combined.subarray(0, 12);
      const authTag = combined.subarray(12, 28);
      const encryptedData = combined.subarray(28);

      // Create decipher with AES-256-GCM
      const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);

      // Set the authentication tag BEFORE decrypting
      decipher.setAuthTag(authTag);

      // Decrypt the data
      let plaintext = decipher.update(encryptedData, undefined, 'utf8');
      plaintext += decipher.final('utf8');

      return plaintext;
    } catch (error) {
      this.logger.error('Decryption failed', error);
      // Re-throw for invalid key, corrupted data, or auth tag mismatch
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  onModuleInit() {
    this.logger.log('EncryptionService initialized with AES-256-GCM');
  }
}
