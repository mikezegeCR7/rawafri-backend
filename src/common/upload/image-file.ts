import { BadRequestException } from '@nestjs/common';

export type DetectedImage = { extension: 'jpg' | 'png' | 'webp'; contentType: string };

/**
 * Identifies an image from its first bytes rather than trusting the
 * client-supplied file name or MIME type, which can be anything.
 */
export function detectImage(buffer: Buffer): DetectedImage | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { extension: 'jpg', contentType: 'image/jpeg' };
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { extension: 'png', contentType: 'image/png' };
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { extension: 'webp', contentType: 'image/webp' };
  }
  return null;
}

/** Throws a 400 unless the upload really is a JPEG, PNG or WebP image. */
export function requireImage(file: Express.Multer.File): DetectedImage {
  const image = detectImage(file.buffer);
  if (!image) {
    throw new BadRequestException('Please upload a JPG, PNG or WebP image.');
  }
  return image;
}
