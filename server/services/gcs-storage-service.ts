import { Storage, type Bucket } from '@google-cloud/storage';
import { uniqueLogoName, type FileStorageProvider } from './file-storage';

// V4 signed URLs can live at most 7 days
const DOCUMENT_URL_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ASSET_URL_TTL_MS = 60 * 60 * 1000;

/**
 * Service account key from GCS_SERVICE_ACCOUNT_KEY, as raw JSON or base64-encoded JSON.
 * When unset, the client falls back to Application Default Credentials
 * (e.g. GOOGLE_APPLICATION_CREDENTIALS pointing at a key file).
 */
function loadCredentials(): Record<string, string> | undefined {
  const raw = process.env.GCS_SERVICE_ACCOUNT_KEY?.trim();
  if (!raw) return undefined;

  const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  try {
    return JSON.parse(json);
  } catch {
    throw new Error('GCS_SERVICE_ACCOUNT_KEY is not valid JSON or base64-encoded JSON');
  }
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
}

export class GcsStorageService implements FileStorageProvider {
  private _bucket?: Bucket;

  // Created on first use so the server can start without GCS credentials.
  private get bucket(): Bucket {
    if (!this._bucket) {
      const bucketName = process.env.GCS_BUCKET_NAME?.trim();
      if (!bucketName) {
        throw new Error('GCS_BUCKET_NAME is not set');
      }
      const credentials = loadCredentials();
      const storage = new Storage(
        credentials ? { credentials, projectId: credentials.project_id } : {},
      );
      this._bucket = storage.bucket(bucketName);
    }
    return this._bucket;
  }

  private async signedReadUrl(objectName: string, ttlMs: number): Promise<string> {
    const [url] = await this.bucket.file(objectName).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + ttlMs,
    });
    return url;
  }

  // Unsigned canonical URL; not readable on its own since the bucket is private.
  private publicUrl(objectName: string): string {
    return `https://storage.googleapis.com/${this.bucket.name}/${objectName
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`;
  }

  // Extract the object name from a URL pointing into this bucket, in either
  // path style (storage.googleapis.com/<bucket>/<object>) or virtual-host style.
  private getObjectNameFromUrl(url: string): string | null {
    const { hostname, pathname } = new URL(url);
    const bucketName = this.bucket.name;
    const path = decodeURIComponent(pathname);

    if (hostname === 'storage.googleapis.com' && path.startsWith(`/${bucketName}/`)) {
      return path.slice(bucketName.length + 2);
    }
    if (hostname === `${bucketName}.storage.googleapis.com`) {
      return path.slice(1);
    }
    return null;
  }

  async uploadFile(buffer: Buffer, fileName: string, contentType: string): Promise<string> {
    try {
      const objectName = `documents/${Date.now()}-${sanitizeFileName(fileName)}`;
      await this.bucket.file(objectName).save(buffer, { contentType, resumable: false });
      console.log(`File uploaded to Google Cloud Storage: ${objectName}`);
      return await this.signedReadUrl(objectName, DOCUMENT_URL_TTL_MS);
    } catch (error) {
      console.error('Error uploading file to Google Cloud Storage:', error);
      throw new Error('Failed to upload file to Google Cloud Storage');
    }
  }

  async getSignedDocumentUrl(url: string): Promise<string> {
    try {
      const objectName = this.getObjectNameFromUrl(url);
      // Not one of ours (e.g. a legacy Azure URL): nothing to re-sign
      if (!objectName) return url;
      return await this.signedReadUrl(objectName, DOCUMENT_URL_TTL_MS);
    } catch (error) {
      console.error('Error generating signed URL for document:', error);
      return url;
    }
  }

  async uploadAssetFile(
    buffer: Buffer,
    originalFileName: string,
    contentType: string,
    userId: number,
  ): Promise<{ fileUrl: string; fileName: string }> {
    try {
      const randomString = Math.random().toString(36).substring(2, 10);
      const objectName = `assets/user-${userId}/${Date.now()}-${randomString}-${sanitizeFileName(originalFileName)}`;
      await this.bucket.file(objectName).save(buffer, { contentType, resumable: false });
      console.log(`Asset file uploaded to Google Cloud Storage: ${objectName}`);
      return { fileUrl: this.publicUrl(objectName), fileName: objectName };
    } catch (error) {
      console.error('Error uploading asset file to Google Cloud Storage:', error);
      throw new Error('Failed to upload asset file to Google Cloud Storage');
    }
  }

  async getAssetFileUrl(fileName: string): Promise<string> {
    try {
      return await this.signedReadUrl(fileName, ASSET_URL_TTL_MS);
    } catch (error) {
      console.error('Error generating URL for asset file:', error);
      throw new Error('Failed to generate URL for asset file');
    }
  }

  async uploadLogo(buffer: Buffer, extension: string, contentType: string): Promise<string> {
    const name = uniqueLogoName(extension);
    await this.bucket.file(`logos/${name}`).save(buffer, { contentType, resumable: false });
    return name;
  }

  async downloadLogo(name: string): Promise<Buffer | null> {
    try {
      const [data] = await this.bucket.file(`logos/${name}`).download();
      return data;
    } catch (error: any) {
      if (error?.code === 404) return null;
      throw error;
    }
  }

  async deleteAssetFile(fileName: string): Promise<void> {
    try {
      await this.bucket.file(fileName).delete({ ignoreNotFound: true });
      console.log(`Asset file deleted from Google Cloud Storage: ${fileName}`);
    } catch (error) {
      console.error('Error deleting asset file from Google Cloud Storage:', error);
      throw new Error('Failed to delete asset file from Google Cloud Storage');
    }
  }
}
