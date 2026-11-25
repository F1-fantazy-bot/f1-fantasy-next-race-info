const assert = require('node:assert/strict');
const { test } = require('node:test');
const { BlobServiceClient } = require('@azure/storage-blob');
const { readBlobProperties } = require('../src/azureBlobStorageService');

test('distinguishes a missing blob from an inaccessible or missing container', async (t) => {
  let error;
  const getProperties = t.mock.fn(async () => {
    throw error;
  });
  t.mock.method(BlobServiceClient, 'fromConnectionString', () => ({
    getContainerClient: () => ({
      getBlockBlobClient: () => ({ getProperties }),
    }),
  }));
  process.env.AZURE_STORAGE_CONNECTION_STRING = 'test';
  process.env.AZURE_STORAGE_CONTAINER_NAME = 'test';
  t.after(() => {
    delete process.env.AZURE_STORAGE_CONNECTION_STRING;
    delete process.env.AZURE_STORAGE_CONTAINER_NAME;
  });

  error = Object.assign(new Error(), {
    statusCode: 404,
    details: { errorCode: 'BlobNotFound' },
  });
  assert.equal(await readBlobProperties('missing'), null);

  for (const [statusCode, errorCode] of [
    [404, 'ContainerNotFound'],
    [403, 'AuthorizationFailure'],
  ]) {
    error = Object.assign(new Error(errorCode), {
      statusCode,
      details: { errorCode },
    });
    await assert.rejects(readBlobProperties('missing'), error);
  }
});
