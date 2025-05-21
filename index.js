// Fetch data from the F1 APIs and generate JSON output

const { fetchAllF1Data } = require('./src/f1DataService');
const fs = require('fs');

async function main() {
  try {
    const outputData = await fetchAllF1Data();
    fs.writeFileSync('output.json', JSON.stringify(outputData, null, 2));
    console.log('Race data:', JSON.stringify(outputData, null, 2));
  } catch (error) {
    console.error('Application error:', error);
    process.exit(1);
  }
}

// Run the application
main();
