import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { env } from '../config/env.js';

let client = null;

function getClient() {
  if (!client) {
    client = new S3Client({
      endpoint: env.s3.endpoint,
      region: env.s3.region,
      forcePathStyle: env.s3.forcePathStyle,
      credentials: env.s3.accessKeyId
        ? { accessKeyId: env.s3.accessKeyId, secretAccessKey: env.s3.secretAccessKey }
        : undefined,
    });
  }
  return client;
}

/**
 * Uploads a buffer (from multer memoryStorage) to S3-compatible storage
 * and returns its public URL. Keeps AWS SDK usage isolated to one module
 * so swapping providers (Cloudflare R2, MinIO, DigitalOcean Spaces...) is a
 * one-file change.
 */
export async function uploadBufferToS3(buffer, { mimetype, folder = 'uploads', originalName = '' }) {
  const ext = originalName.includes('.') ? originalName.split('.').pop() : '';
  const key = `${folder}/${randomUUID()}${ext ? `.${ext}` : ''}`;

  await getClient().send(
    new PutObjectCommand({
      Bucket: env.s3.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
      ACL: 'public-read',
    })
  );

  const base = env.s3.publicBaseUrl || `https://${env.s3.bucket}.s3.${env.s3.region}.amazonaws.com`;
  return `${base.replace(/\/$/, '')}/${key}`;
}

export async function deleteFromS3(url) {
  const base = env.s3.publicBaseUrl || `https://${env.s3.bucket}.s3.${env.s3.region}.amazonaws.com`;
  if (!url.startsWith(base)) return;
  const key = url.slice(base.length + 1);
  await getClient().send(new DeleteObjectCommand({ Bucket: env.s3.bucket, Key: key }));
}
