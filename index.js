// Fetch data from the F1 APIs and generate JSON output

require('dotenv').config();
const { fetchAllF1Data } = require('./src/f1DataService');
const { uploadJsonToBlob } = require('./src/azureBlobStorageService');
const { sendTelegramMessage } = require('./src/telegramService');

async function main() {
  try {
    const outputData = await fetchAllF1Data();
    const jsonString = JSON.stringify(outputData, null, 2);

    const blobName = 'next-race-info.json';
    await uploadJsonToBlob(jsonString, blobName);

    await sendTelegramMessage(
      `✅ Successfully uploaded race data to Azure Blob Storage as ${blobName}.`,
    );

    console.log(jsonString); // Log JSON to console
    console.log(`Race data uploaded to Azure Blob Storage as ${blobName}`);
  } catch (error) {
    await sendTelegramMessage(
      `❌ Failed to upload race data to Azure Blob Storage. Error: ${error.message}`,
    );
    console.error('Application error:', error);
    process.exit(1);
  }
}

// Run the application
main();
