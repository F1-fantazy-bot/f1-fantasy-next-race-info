const test = require('node:test');
const assert = require('node:assert/strict');

const telegramModulePath = require.resolve('../src/telegramService');
const serviceModulePath = require.resolve(
  '../src/wikipediaCircuitImageService',
);

const SUZUKA_URL =
  'https://en.wikipedia.org/wiki/Suzuka_International_Racing_Course';
const SUZUKA_IMAGE_URL =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Suzuka_circuit_map--2005.svg/1000px-Suzuka_circuit_map--2005.svg.png';
const BARCELONA_URL =
  'https://en.wikipedia.org/wiki/Circuit_de_Barcelona-Catalunya';
const BARCELONA_IMAGE_URL =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Formula1_Circuit_Catalunya_2021.svg/1000px-Formula1_Circuit_Catalunya_2021.svg.png';
const MONACO_URL = 'https://en.wikipedia.org/wiki/Circuit_de_Monaco';
const MONACO_IMAGE_URL =
  'https://upload.wikimedia.org/wikipedia/commons/3/36/Monte_Carlo_Formula_1_track_map.svg';
const RED_BULL_RING_URL = 'https://en.wikipedia.org/wiki/Red_Bull_Ring';

delete require.cache[telegramModulePath];
require.cache[telegramModulePath] = {
  id: telegramModulePath,
  filename: telegramModulePath,
  loaded: true,
  exports: {
    sendTelegramMessage: async () => {},
  },
};
delete require.cache[serviceModulePath];

const { fetchCircuitImage } = require('../src/wikipediaCircuitImageService');

function createJsonResponse(body, ok = true, status = 200) {
  return {
    ok,
    status,
    async json() {
      return body;
    },
  };
}

function withMockedFetch(responses) {
  const originalFetch = global.fetch;
  const queue = [...responses];

  global.fetch = async () => {
    if (queue.length === 0) {
      throw new Error('Unexpected extra fetch call');
    }

    const next = queue.shift();
    if (next instanceof Error) {
      throw next;
    }

    return next;
  };

  return () => {
    global.fetch = originalFetch;
    assert.equal(queue.length, 0, 'Not all mocked fetch responses were used');
  };
}

test('returns the infobox image URL for a real circuit page URL', async () => {
  const restore = withMockedFetch([
    createJsonResponse({
      parse: {
        wikitext: {
          '*': '| image = Suzuka circuit map--2005.svg',
        },
      },
    }),
    createJsonResponse({
      query: {
        pages: {
          1: {
            imageinfo: [{ thumburl: SUZUKA_IMAGE_URL }],
          },
        },
      },
    }),
  ]);

  try {
    const imageUrl = await fetchCircuitImage(SUZUKA_URL);

    assert.equal(imageUrl, SUZUKA_IMAGE_URL);
  } finally {
    restore();
  }
});

test('falls back to track_map when the infobox image is missing', async () => {
  const restore = withMockedFetch([
    createJsonResponse({
      parse: {
        wikitext: {
          '*': '| track_map = [[File:Formula1 Circuit Catalunya 2021.svg|250px]]',
        },
      },
    }),
    createJsonResponse({
      query: {
        pages: {
          1: {
            imageinfo: [{ thumburl: BARCELONA_IMAGE_URL }],
          },
        },
      },
    }),
  ]);

  try {
    const imageUrl = await fetchCircuitImage(BARCELONA_URL);

    assert.equal(imageUrl, BARCELONA_IMAGE_URL);
  } finally {
    restore();
  }
});

test('falls back to the page thumbnail when the infobox has no usable image', async () => {
  const restore = withMockedFetch([
    createJsonResponse({
      parse: {
        wikitext: {
          '*': '| location = Monaco',
        },
      },
    }),
    createJsonResponse({
      query: {
        pages: {
          1: {
            thumbnail: {
              source: MONACO_IMAGE_URL,
            },
          },
        },
      },
    }),
  ]);

  try {
    const imageUrl = await fetchCircuitImage(MONACO_URL);

    assert.equal(imageUrl, MONACO_IMAGE_URL);
  } finally {
    restore();
  }
});

test('returns null when no circuit image can be resolved', async () => {
  const restore = withMockedFetch([
    createJsonResponse({
      parse: {
        wikitext: {
          '*': '| location = Spielberg',
        },
      },
    }),
    createJsonResponse({
      query: {
        pages: {
          1: {},
        },
      },
    }),
  ]);

  try {
    const imageUrl = await fetchCircuitImage(RED_BULL_RING_URL);

    assert.equal(imageUrl, null);
  } finally {
    restore();
  }
});
