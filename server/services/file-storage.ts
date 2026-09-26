import { AzureStorageService } from './azure-storage-service';
import { GcsStorageService } from './gcs-storage-service';

/** Storage backend for uploaded PDF documents and digital asset files. */
export interface FileStorageProvider {
  /** Uploads a PDF document; returns a time-limited read URL. */
  uploadFile(buffer: Buffer, fileName: string, contentType: string): Promise<string>;
  /** Returns a fresh time-limited read URL for a URL previously returned by uploadFile. */
  getSignedDocumentUrl(url: string): Promise<string>;
  uploadAssetFile(
    buffer: Buffer,
    originalFileName: string,
    contentType: string,
    userId: number,
  ): Promise<{ fileUrl: string; fileName: string }>;
  /** Returns a short-lived read URL for an asset's storage file name. */
  getAssetFileUrl(fileName: string): Promise<string>;
  deleteAssetFile(fileName: string): Promise<void>;
}

// STORAGE_PROVIDER=gcs|azure; defaults to GCS when a bucket is configured.
function selectProvider(): FileStorageProvider {
  const provider =
    process.env.STORAGE_PROVIDER?.trim().toLowerCase() ||
    (process.env.GCS_BUCKET_NAME ? 'gcs' : 'azure');

  if (provider === 'gcs') {
    if (!process.env.GCS_BUCKET_NAME) {
      console.warn('GCS_BUCKET_NAME not set. PDF and asset uploads will not work.');
    }
    return new GcsStorageService();
  }

  if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
    console.warn('No file storage configured (set GCS_BUCKET_NAME or AZURE_STORAGE_CONNECTION_STRING). PDF and asset uploads will not work.');
  }
  return new AzureStorageService();
}

export const fileStorage = selectProvider();
