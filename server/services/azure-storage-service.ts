import { BlobServiceClient, ContainerClient, BlockBlobClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } from '@azure/storage-blob';

// Check if Azure Storage credentials are available
if (!process.env.AZURE_STORAGE_CONNECTION_STRING || !process.env.AZURE_STORAGE_CONTAINER_NAME) {
  console.warn('Azure Storage credentials not found. PDF document uploads will not work.');
}

export class AzureStorageService {
  private blobServiceClient: BlobServiceClient;
  private containerClient: ContainerClient;
  private containerName: string;
  private accountName: string;
  private accountKey: string;

  constructor() {
    // Initialize Azure Storage client
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    this.containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'documents';

    if (!connectionString) {
      throw new Error('Azure Storage connection string is not provided');
    }

    try {
      // Parse connection string to get account name and key
      const connectionStringParts = connectionString.split(';');
      const accountNamePart = connectionStringParts.find(part => part.startsWith('AccountName='));
      const accountKeyPart = connectionStringParts.find(part => part.startsWith('AccountKey='));
      
      if (!accountNamePart || !accountKeyPart) {
        throw new Error('Invalid connection string format');
      }
      
      this.accountName = accountNamePart.split('=')[1];
      this.accountKey = accountKeyPart.split('=')[1];
      
      this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      this.containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      
      // Ensure container exists
      this.initializeContainer().catch(err => {
        console.error('Failed to initialize Azure Storage container:', err);
      });
    } catch (error) {
      console.error('Failed to initialize Azure Storage client:', error);
      throw new Error('Failed to initialize Azure Storage client');
    }
  }

  // Initialize container if it doesn't exist
  private async initializeContainer(): Promise<void> {
    try {
      // Create the container if it doesn't exist
      const containerExists = await this.containerClient.exists();
      if (!containerExists) {
        console.log(`Creating container '${this.containerName}'...`);
        await this.containerClient.create({
          access: 'blob', // Public access at blob level
        });
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
  getBlobUrlWithSAS(url: string): string {
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
}

// Singleton instance
export const azureStorageService = new AzureStorageService();