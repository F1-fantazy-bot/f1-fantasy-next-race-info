const { BlobServiceClient } = require('@azure/storage-blob');

let containerClient;

function getBlockBlob(blobName) {
  if (!containerClient) {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;
    if (!connectionString || !containerName) {
      throw new Error(
        'Azure Storage connection string or container name not set in environment variables.',
      );
    }
    containerClient =
      BlobServiceClient.fromConnectionString(
        connectionString,
      ).getContainerClient(containerName);
  }
  return containerClient.getBlockBlobClient(blobName);
}

async function uploadJsonToBlob(jsonData, blobName, options) {
  await getBlockBlob(blobName).upload(jsonData, Buffer.byteLength(jsonData), {
    blobHTTPHeaders: { blobContentType: 'application/json' },
    ...options,
  });
  return `Uploaded to Azure Blob Storage: ${blobName}`;
}

async function readBlobProperties(blobName) {
  try {
    return await getBlockBlob(blobName).getProperties();
  } catch (error) {
    // HEAD responses can carry the storage error code only in response details.
    if ((error.code ?? error.details?.errorCode) === 'BlobNotFound')
      return null;
    throw error;
  }
}

module.exports = { uploadJsonToBlob, readBlobProperties };
