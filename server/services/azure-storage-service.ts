import { BlobServiceClient, ContainerClient, BlockBlobClient } from '@azure/storage-blob';

// Check if Azure Storage credentials are available
if (!process.env.AZURE_STORAGE_CONNECTION_STRING || !process.env.AZURE_STORAGE_CONTAINER_NAME) {
  console.warn('Azure Storage credentials not found. PDF document uploads will not work.');
}

export class AzureStorageService {
  private blobServiceClient: BlobServiceClient;
  private containerClient: ContainerClient;
  private containerName: string;

  constructor() {
    // Initialize Azure Storage client
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    this.containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'documents';

    if (!connectionString) {
      throw new Error('Azure Storage connection string is not provided');
    }

    try {
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
      
      // Return the URL to the uploaded blob
      return blockBlobClient.url;
    } catch (error) {
      console.error('Error uploading file to Azure Storage:', error);
      throw new Error('Failed to upload file to Azure Storage');
    }
  }

  // Get a blob's download URL
  getBlobUrl(blobName: string): string {
    return this.getBlockBlobClient(blobName).url;
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