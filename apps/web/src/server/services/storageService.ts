import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { env } from '../config/env';
import { AppError, ErrorCode } from '../lib/errors';
import { logger } from '../lib/logger';

export interface UploadResult {
  url: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
}

export class StorageService {
  private static readonly ALLOWED_MAGIC_BYTES: Record<string, number[]> = {
    'image/jpeg': [0xff, 0xd8, 0xff],
    'image/png': [0x89, 0x50, 0x4e, 0x47],
    'image/webp': [0x52, 0x49, 0x46, 0x46], // 'RIFF'
  };

  /**
   * Validate image buffer using magic bytes (prevents extension spoofing & SVG attacks).
   */
  static validateMagicBytes(buffer: Buffer): { isValid: boolean; mimeType: string } {
    if (buffer.length < 4) {
      return { isValid: false, mimeType: '' };
    }

    for (const [mime, signature] of Object.entries(this.ALLOWED_MAGIC_BYTES)) {
      const matches = signature.every((byte, idx) => buffer[idx] === byte);
      if (matches) {
        if (mime === 'image/webp') {
          // Extra check for WEBP header at byte 8..12: 'WEBP'
          if (buffer.length >= 12) {
            const webpText = buffer.subarray(8, 12).toString('ascii');
            if (webpText === 'WEBP') {
              return { isValid: true, mimeType: 'image/webp' };
            }
          }
        } else {
          return { isValid: true, mimeType: mime };
        }
      }
    }

    return { isValid: false, mimeType: '' };
  }

  /**
   * Save uploaded file to disk with a random UUID name.
   */
  static async uploadImage(buffer: Buffer, originalName: string): Promise<UploadResult> {
    if (buffer.length > env.MAX_UPLOAD_SIZE_BYTES) {
      throw new AppError(
        `File exceeds maximum upload size of ${env.MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)}MB`,
        413,
        ErrorCode.PAYLOAD_TOO_LARGE
      );
    }

    const { isValid, mimeType } = this.validateMagicBytes(buffer);
    if (!isValid) {
      throw new AppError(
        'Invalid or unsupported image format. Only JPEG, PNG, and WebP are allowed.',
        415,
        ErrorCode.UNSUPPORTED_MEDIA_TYPE
      );
    }

    const ext = mimeType === 'image/jpeg' ? '.jpg' : mimeType === 'image/png' ? '.png' : '.webp';
    const filename = `${crypto.randomUUID()}${ext}`;

    const uploadDir = path.resolve(process.cwd(), 'public', 'uploads');
    await fs.mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, filename);
    await fs.writeFile(filePath, buffer);

    logger.info('Image uploaded successfully', undefined, { filename, size: buffer.length });

    return {
      url: `/uploads/${filename}`,
      filename,
      sizeBytes: buffer.length,
      mimeType,
    };
  }
}
