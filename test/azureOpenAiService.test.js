const test = require('node:test');
const assert = require('node:assert/strict');

const openAiPath = require.resolve('openai');
const servicePath = require.resolve('../src/azureOpenAiService');

for (const oldModel of [undefined, 'incompatible-deployment']) {
  test(`pins Sol when the old model setting is ${oldModel}`, async () => {
    const originalEnv = process.env;
    const originalOpenAi = require.cache[openAiPath];
    const originalService = require.cache[servicePath];
    const requests = [];
    process.env = {
      ...originalEnv,
      AZURE_OPENAI_ENDPOINT: 'https://example.openai.azure.com',
      AZURE_OPENAI_API_KEY: 'test-key',
    };
    delete process.env.AZURE_OPEN_AI_MODEL;
    if (oldModel) process.env.AZURE_OPEN_AI_MODEL = oldModel;
    require.cache[openAiPath] = {
      id: openAiPath,
      filename: openAiPath,
      loaded: true,
      exports: {
        AzureOpenAI: class {
          constructor(options) {
            assert.equal(options.apiVersion, '2024-04-01-preview');
            this.chat = {
              completions: {
                async create(request) {
                  requests.push(request);
                  return {
                    choices: [{ message: { content: ' Circuit history. ' } }],
                    usage: {
                      prompt_tokens: 1,
                      completion_tokens: 2,
                      total_tokens: 3,
                    },
                  };
                },
              },
            };
          }
        },
      },
    };
    delete require.cache[servicePath];
    try {
      const { getTrackHistoricalInfo } = require('../src/azureOpenAiService');
      const result = await getTrackHistoricalInfo('Suzuka', 'Japan', {
        locality: 'Suzuka',
        country: 'Japan',
      });
      assert.equal(result, 'Circuit history.');
      assert.equal(requests.length, 1);
      assert.equal(requests[0].model, 'gpt-6.1-sol');
      assert.match(requests[0].messages[1].content, /Suzuka/);
    } finally {
      process.env = originalEnv;
      if (originalOpenAi) require.cache[openAiPath] = originalOpenAi;
      else delete require.cache[openAiPath];
      if (originalService) require.cache[servicePath] = originalService;
      else delete require.cache[servicePath];
    }
  });
}
