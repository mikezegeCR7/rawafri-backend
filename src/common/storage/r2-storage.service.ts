import { Injectable, Logger } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

/**
 * Uploads files to Cloudflare R2 (S3-compatible API). Using the S3 SDK
 * rather than an R2-specific one means this also works unmodified against
 * real AWS S3, Backblaze B2, DigitalOcean Spaces, etc. if that's ever
 * swapped later — just change the endpoint/credentials.
 */
@Injectable()
export class R2StorageService {
  private readonly logger = new Logger(R2StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor() {
    const accountId = process.env.R2_ACCOUNT_ID ?? '';
    this.bucket = process.env.R2_BUCKET_NAME ?? '';
    this.publicUrl = (process.env.R2_PUBLIC_URL ?? '').replace(/\/+$/, '');

    if (!accountId || !this.bucket || !this.publicUrl) {
      this.logger.warn(
        'R2 storage is not fully configured (R2_ACCOUNT_ID / R2_BUCKET_NAME / R2_PUBLIC_URL). File uploads will fail until these are set in .env.',
      );
    }

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
      },
    });
  }

  /** Uploads a buffer under the given key and returns its public URL. */
  async uploadFile(
    buffer: Buffer,
    key: string,
    contentType: string,
  ): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    return `${this.publicUrl}/${key}`;
  }
}