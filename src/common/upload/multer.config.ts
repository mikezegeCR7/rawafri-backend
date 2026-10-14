import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';

// Files are held in memory only, never written to local disk — the buffer
// is uploaded straight to Cloudflare R2 (see R2StorageService). This is
// what makes uploads survive redeploys on hosts with ephemeral filesystems.
export const paymentStorage = memoryStorage();

// Same underlying engine, used for admin-uploaded images (product photos,
// etc). Kept as a separate export mainly for readability at call sites.
export const imageUploadStorage = memoryStorage();

import { FileFilterCallback } from 'multer';

export const imageFileFilter = (
  _: Express.Request,
  file: Express.Multer.File,
 cb: (error: Error | null, acceptFile: boolean) => void
) => {
  // First-pass filter on the declared type; the service then checks the real
  // file contents (see requireImage). BadRequestException so the client gets
  // a 400 with this message instead of a generic 500.
  if (!file.mimetype.match(/^image\/(jpg|jpeg|png|webp)$/)) {
    return cb(new BadRequestException('Please upload a JPG, PNG or WebP image.'), false);
  }

  cb(null, true);
};