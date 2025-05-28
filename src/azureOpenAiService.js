const { AzureOpenAI } = require('openai');
const { HistoricalInformationAboutNextRacePrompt } = require('./prompts');
const { AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPEN_AI_MODEL } =
  process.env;

// Module-level variables for client state
let client = null;
let initialized = false;

/**
 * Initialize the Azure OpenAI client
 * @private
 */
async function initializeClient() {
  if (initialized) return;

  try {
    if (
      !AZURE_OPENAI_ENDPOINT ||
      !AZURE_OPENAI_API_KEY ||
      !AZURE_OPEN_AI_MODEL
    ) {
      throw new Error(
        'Missing required environment variables: AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPEN_AI_MODEL',
      );
    }

    const apiVersion = '2024-04-01-preview';
    const options = {
      AZURE_OPENAI_ENDPOINT,
      AZURE_OPENAI_API_KEY,
      AZURE_OPEN_AI_MODEL,
      apiVersion,
    };

    client = new AzureOpenAI(options);
    initialized = true;
    console.log('Azure OpenAI client initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Azure OpenAI client:', error);
    throw error;
  }
}

/**
 * Get historical information about a Formula 1 track
 * @param {string} circuitName - Name of the circuit
 * @param {string} raceName - Name of the race
 * @param {Object} location - Location object with locality and country
 * @returns {Promise<string|null>} Historical information as a string, or null if failed
 */
async function getTrackHistoricalInfo(circuitName, raceName, location) {
  try {
    await initializeClient();

    const userPrompt = `Circuit: ${circuitName}
Race: ${raceName}
Location: ${location.locality}, ${location.country}

Please provide historical information about this Formula 1 circuit.`;

    const messages = [
      {
        role: 'system',
        content: HistoricalInformationAboutNextRacePrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ];

    const response = await client.chat.completions.create({
      model: AZURE_OPEN_AI_MODEL,
      messages: messages,
      // max_tokens: 400,
      // temperature: 0.3,
      // top_p: 0.9,
    });

    const azureOpenAiTokensString = `Azure OpenAI model - ${AZURE_OPEN_AI_MODEL}, tokens - prompt: ${response.usage.prompt_tokens}, completion: ${response.usage.completion_tokens}, total: ${response.usage.total_tokens}`;
    console.log(azureOpenAiTokensString);

    if (response.choices && response.choices.length > 0) {
      const historicalInfo = response.choices[0].message?.content?.trim();

      if (historicalInfo && historicalInfo.length > 0) {
        console.log(`Generated historical info for ${circuitName}`);
        return historicalInfo;
      }
    }

    console.warn('No valid response received from Azure OpenAI');
    return null;
  } catch (error) {
    console.error('Error getting track historical information:', error);
    return null;
  }
}

module.exports = {
  getTrackHistoricalInfo,
};
