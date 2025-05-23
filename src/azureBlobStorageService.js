const { BlobServiceClient } = require('@azure/storage-blob');

async function uploadJsonToBlob(jsonData, blobName) {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;

  if (!connectionString || !containerName) {
    throw new Error(
      'Azure Storage connection string or container name not set in environment variables.',
    );
  }

  const blobServiceClient =
    BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  await blockBlobClient.upload(jsonData, Buffer.byteLength(jsonData));
  return `Uploaded to Azure Blob Storage: ${blobName}`;
}

module.exports = { uploadJsonToBlob };
