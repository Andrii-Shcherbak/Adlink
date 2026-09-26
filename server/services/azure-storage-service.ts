import { BlobServiceClient, ContainerClient, BlockBlobClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } from '@azure/storage-blob';
import type { FileStorageProvider } from './file-storage';

export class AzureStorageService implements FileStorageProvider {
  private _blobServiceClient?: BlobServiceClient;
  private _containerClient?: ContainerClient;
  private containerName = '';
  private accountName = '';
  private accountKey = '';

  // Clients are created on first use so the server can start without Azure credentials.
  private get containerClient(): ContainerClient {
    if (!this._containerClient) this.initialize();
    return this._containerClient!;
  }

  private initialize(): void {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING?.trim();
    this.containerName = process.env.AZURE_STORAGE_CONTAINER_NAME?.trim() || 'documents';

    if (!connectionString) {
      throw new Error('Azure Storage connection string is not provided');
    }

    // Parse connection string to get account name and key
    const connectionStringParts = connectionString.split(';');
    const accountNamePart = connectionStringParts.find(part => part.startsWith('AccountName='));
    const accountKeyPart = connectionStringParts.find(part => part.startsWith('AccountKey='));

    if (!accountNamePart || !accountKeyPart) {
      throw new Error('Invalid Azure Storage connection string format');
    }

    this.accountName = accountNamePart.slice('AccountName='.length);
    // Account keys are base64 and end in '=', so don't split on '='
    this.accountKey = accountKeyPart.slice('AccountKey='.length);

    this._blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    this._containerClient = this._blobServiceClient.getContainerClient(this.containerName);

    // Ensure container exists
    this.initializeContainer().catch(err => {
      console.error('Failed to initialize Azure Storage container:', err);
    });
  }

  // Initialize container if it doesn't exist
  private async initializeContainer(): Promise<void> {
    try {
      // Create the container if it doesn't exist
      const containerExists = await this.containerClient.exists();
      if (!containerExists) {
        console.log(`Creating container '${this.containerName}'...`);
        // Private container: blobs are served through SAS URLs, and newer storage
        // accounts reject public access by default.
        await this.containerClient.create();
        console.log(`Container '${this.containerName}' created successfully`);
      }
    } catch (error) {
      console.error('Error initializing container:', error);
      throw error;
    }
  }

  // Get a block blob client
  private getBlockBlobClient(blobName: string): BlockBlobClient {
    return this.containerClient.getBlockBlobClient(blobName);
  }

  // Generate a SAS token for a blob
  private generateBlobSASToken(blobName: string): string {
    // Create a shared key credential
    const sharedKeyCredential = new StorageSharedKeyCredential(
      this.accountName,
      this.accountKey
    );

    // Set start time to 5 minutes ago to avoid clock skew issues
    const startDate = new Date();
    startDate.setMinutes(startDate.getMinutes() - 5);

    // Set expiry time to 7 days from now
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7);

    // Generate SAS token with read permissions
    const permissions = new BlobSASPermissions();
    permissions.read = true; // Only allow read operations
    
    const sasOptions = {
      containerName: this.containerName,
      blobName: blobName,
      permissions: permissions,
      startsOn: startDate,
      expiresOn: expiryDate,
    };

    const sasToken = generateBlobSASQueryParameters(
      sasOptions,
      sharedKeyCredential
    ).toString();

    return sasToken;
  }

  // Extract blob name from full URL
  private getBlobNameFromUrl(url: string): string {
    // Extract the blob name from the URL
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    // Format: /containername/blobname
    const parts = path.split('/');
    return parts[parts.length - 1];
  }

  // Upload a file to Azure Storage
  async uploadFile(buffer: Buffer, fileName: string, contentType: string): Promise<string> {
    try {
      // Generate a unique blob name by adding timestamp
      const timestamp = new Date().getTime();
      const uniqueBlobName = `${timestamp}-${fileName}`;
      
      const blockBlobClient = this.getBlockBlobClient(uniqueBlobName);
      
      // Upload the file
      await blockBlobClient.upload(buffer, buffer.length, {
        blobHTTPHeaders: {
          blobContentType: contentType
        }
      });
      
      // Generate a SAS token for the blob and append it to the URL
      const sasToken = this.generateBlobSASToken(uniqueBlobName);
      const blobUrlWithSAS = `${blockBlobClient.url}?${sasToken}`;
      
      console.log(`File uploaded to Azure Storage: ${blockBlobClient.url}`);
      console.log(`Secured URL with SAS token generated (token valid for 7 days)`);
      
      // Return the URL with SAS token
      return blobUrlWithSAS;
    } catch (error) {
      console.error('Error uploading file to Azure Storage:', error);
      throw new Error('Failed to upload file to Azure Storage');
    }
  }

  // Get a blob's download URL with SAS token
  async getSignedDocumentUrl(url: string): Promise<string> {
    try {
      // Extract the blob name from the URL
      const blobName = this.getBlobNameFromUrl(url);
      
      // Get the blob client
      const blockBlobClient = this.getBlockBlobClient(blobName);
      
      // Generate a SAS token for the blob
      const sasToken = this.generateBlobSASToken(blobName);
      
      // Return the URL with SAS token
      return `${blockBlobClient.url}?${sasToken}`;
    } catch (error) {
      console.error('Error generating SAS token for blob:', error);
      // Return original URL as fallback
      return url;
    }
  }

  // Delete a blob from Azure Storage
  async deleteBlob(blobName: string): Promise<void> {
    try {
      const blockBlobClient = this.getBlockBlobClient(blobName);
      await blockBlobClient.delete();
    } catch (error) {
      console.error('Error deleting blob from Azure Storage:', error);
      throw new Error('Failed to delete blob from Azure Storage');
    }
  }
  
  // Digital Asset Management methods
  
  // Upload a digital asset file
  async uploadAssetFile(buffer: Buffer, originalFileName: string, contentType: string, userId: number): Promise<{fileUrl: string, fileName: string}> {
    try {
      // Create a folder structure for user assets
      const userAssetsFolder = `assets/user-${userId}`;
      
      // Generate a unique blob name by adding timestamp and random string
      const timestamp = new Date().getTime();
      const randomString = Math.random().toString(36).substring(2, 10);
      const sanitizedFileName = originalFileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const uniqueBlobName = `${userAssetsFolder}/${timestamp}-${randomString}-${sanitizedFileName}`;
      
      const blockBlobClient = this.getBlockBlobClient(uniqueBlobName);
      
      // Upload the file
      await blockBlobClient.upload(buffer, buffer.length, {
        blobHTTPHeaders: {
          blobContentType: contentType
        }
      });
      
      console.log(`Asset file uploaded to Azure Storage: ${blockBlobClient.url}`);
      
      // Return the URL and generated filename (without the path prefix)
      return {
        fileUrl: blockBlobClient.url,
        fileName: uniqueBlobName
      };
    } catch (error) {
      console.error('Error uploading asset file to Azure Storage:', error);
      throw new Error('Failed to upload asset file to Azure Storage');
    }
  }
  
  // Get a secure URL for viewing a digital asset
  async getAssetFileUrl(fileName: string): Promise<string> {
    try {
      // Get the blob client
      const blockBlobClient = this.getBlockBlobClient(fileName);
      
      // Generate a SAS token for the blob with short expiry for security
      const sasToken = this.generateAssetSASToken(fileName);
      
      // Return the URL with SAS token
      return `${blockBlobClient.url}?${sasToken}`;
    } catch (error) {
      console.error('Error generating URL for asset file:', error);
      throw new Error('Failed to generate URL for asset file');
    }
  }
  
  // Generate a SAS token with shorter expiry for digital assets
  private generateAssetSASToken(blobName: string): string {
    // Create a shared key credential
    const sharedKeyCredential = new StorageSharedKeyCredential(
      this.accountName,
      this.accountKey
    );

    // Set start time to now
    const startDate = new Date();
    
    // Set expiry time to 1 hour from now for security (can be adjusted)
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + 1);

    // Generate SAS token with read permissions only
    const permissions = new BlobSASPermissions();
    permissions.read = true;
    
    const sasOptions = {
      containerName: this.containerName,
      blobName: blobName,
      permissions: permissions,
      startsOn: startDate,
      expiresOn: expiryDate,
    };

    const sasToken = generateBlobSASQueryParameters(
      sasOptions,
      sharedKeyCredential
    ).toString();

    return sasToken;
  }
  
  // Delete an asset file
  async deleteAssetFile(fileName: string): Promise<void> {
    try {
      const blockBlobClient = this.getBlockBlobClient(fileName);
      await blockBlobClient.delete();
      console.log(`Asset file deleted from Azure Storage: ${fileName}`);
    } catch (error) {
      console.error('Error deleting asset file from Azure Storage:', error);
      throw new Error('Failed to delete asset file from Azure Storage');
    }
  }
}
