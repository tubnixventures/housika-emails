import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface R2AttachmentMetadata {
  key: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
  url?: string;
}

// In-memory fallback for local preview / dev sandbox when R2 credentials are not yet supplied
interface MockR2Item {
  key: string;
  content: Buffer;
  contentType: string;
  filename: string;
  uploadedAt: string;
}
const mockR2Store = new Map<string, MockR2Item>();

let s3Client: S3Client | null = null;

function getS3Client(): S3Client | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null;
  }

  if (!s3Client) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    });
  }
  return s3Client;
}

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'housika-email-attachments';
const PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

/**
 * Upload an attachment or raw MIME file to Cloudflare R2
 */
export async function uploadToR2(params: {
  key: string;
  content: Buffer | string;
  contentType: string;
  filename: string;
}): Promise<R2AttachmentMetadata> {
  const buffer = typeof params.content === 'string' ? Buffer.from(params.content, 'utf-8') : params.content;
  const sizeBytes = buffer.length;
  const client = getS3Client();

  if (client) {
    try {
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: params.key,
        Body: buffer,
        ContentType: params.contentType,
        Metadata: {
          filename: encodeURIComponent(params.filename),
          uploadedAt: new Date().toISOString()
        }
      });
      await client.send(command);
    } catch (err: any) {
      console.error(`[R2] Upload failed to Cloudflare R2: ${err.message}. Falling back to virtual storage.`);
    }
  }

  // Also cache in virtual store for dev inspection and guaranteed preview availability
  mockR2Store.set(params.key, {
    key: params.key,
    content: buffer,
    contentType: params.contentType,
    filename: params.filename,
    uploadedAt: new Date().toISOString()
  });

  const url = PUBLIC_URL ? `${PUBLIC_URL.replace(/\/$/, '')}/${params.key}` : `/api/emails/attachments/download?key=${encodeURIComponent(params.key)}`;

  return {
    key: params.key,
    filename: params.filename,
    contentType: params.contentType,
    sizeBytes,
    uploadedAt: new Date().toISOString(),
    url
  };
}

/**
 * Generate a presigned URL or download link for an R2 object
 */
export async function getR2PresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  const client = getS3Client();
  if (client) {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
      });
      return await getSignedUrl(client, command, { expiresIn });
    } catch (err) {
      console.warn(`[R2] Presigned URL generation failed:`, err);
    }
  }

  return `/api/emails/attachments/download?key=${encodeURIComponent(key)}`;
}

/**
 * Retrieve raw file from R2 or virtual store
 */
export async function getR2File(key: string): Promise<{ buffer: Buffer; contentType: string; filename: string } | null> {
  const client = getS3Client();
  if (client) {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
      });
      const response = await client.send(command);
      if (response.Body) {
        const streamToBuffer = async (stream: any): Promise<Buffer> => {
          return new Promise((resolve, reject) => {
            const chunks: any[] = [];
            stream.on('data', (chunk: any) => chunks.push(chunk));
            stream.on('error', reject);
            stream.on('end', () => resolve(Buffer.concat(chunks)));
          });
        };
        const buffer = await streamToBuffer(response.Body);
        return {
          buffer,
          contentType: response.ContentType || 'application/octet-stream',
          filename: key.split('/').pop() || 'file'
        };
      }
    } catch (err: any) {
      console.warn(`[R2] Direct S3 fetch failed, checking virtual store:`, err.message);
    }
  }

  const local = mockR2Store.get(key);
  if (local) {
    return {
      buffer: local.content,
      contentType: local.contentType,
      filename: local.filename
    };
  }

  return null;
}

/**
 * Delete a file from R2
 */
export async function deleteFromR2(key: string): Promise<boolean> {
  mockR2Store.delete(key);
  const client = getS3Client();
  if (client) {
    try {
      await client.send(new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
      }));
      return true;
    } catch (err) {
      console.error(`[R2] Delete failed:`, err);
      return false;
    }
  }
  return true;
}

/**
 * List all items in the virtual / R2 store for developer inspection
 */
export async function listVirtualR2Items(): Promise<Array<{ key: string; filename: string; sizeBytes: number; contentType: string; uploadedAt: string }>> {
  return Array.from(mockR2Store.values()).map(item => ({
    key: item.key,
    filename: item.filename,
    sizeBytes: item.content.length,
    contentType: item.contentType,
    uploadedAt: item.uploadedAt
  }));
}
