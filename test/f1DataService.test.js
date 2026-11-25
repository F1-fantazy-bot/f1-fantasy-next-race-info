const assert = require('node:assert/strict');
const { test } = require('node:test');
const storage = require('../src/azureBlobStorageService');
const ai = require('../src/azureOpenAiService');
const wikipedia = require('../src/wikipediaCircuitImageService');

function race(season, round, date, circuitId = 'example') {
  return {
    season: String(season),
    round: String(round),
    raceName: 'Fixture Grand Prix',
    date,
    time: '12:00:00Z',
    Circuit: {
      circuitId,
      circuitName: 'Fixture Circuit',
      url: 'https://example.com/circuit',
      Location: { lat: '0', long: '1', locality: 'City', country: 'Country' },
    },
  };
}

function cachedSeason(season, races, total = races.length) {
  return {
    fetchedAt: '2026-04-01T00:00:00Z',
    MRData: {
      limit: '100',
      offset: '0',
      total: String(total),
      RaceTable: { season: String(season), Races: races },
    },
  };
}

test('enriches the earliest upcoming race using complete cached seasons', async (t) => {
  t.mock.timers.enable({
    apis: ['Date'],
    now: new Date('2026-05-01T00:00:00Z'),
  });
  const calendar = cachedSeason(2026, [
    race(2026, 3, '2026-06-15', 'later'),
    race(2026, 1, '2026-04-15', 'past'),
    race(2026, 2, '2026-05-15'),
  ]);
  const podium = [1, 2, 3].map((position) => ({
    position: String(position),
    grid: String(position),
    status: 'Finished',
    Driver: {
      driverId: `driver-${position}`,
      givenName: 'Test',
      familyName: `Driver ${position}`,
    },
    Constructor: { name: 'Fixture Team' },
  }));
  let failingSeason;
  let failure;

  const reads = t.mock.fn(async (path) => {
    if (path === 'jolpica/calendar.json') return calendar;
    assert.match(path, /^jolpica\/results\/\d{4}\.json$/);
    const year = Number(path.match(/\d{4}/)[0]);
    if (year === failingSeason && failure === 'missing')
      throw new Error('BlobNotFound');

    const circuitId = year === 2016 ? 'example' : 'other';
    return cachedSeason(
      year,
      [
        {
          ...race(year, 1, `${year}-06-15`, circuitId),
          Results: podium,
        },
      ],
      year === failingSeason ? podium.length + 1 : podium.length,
    );
  });
  t.mock.method(storage, 'readJsonFromBlob', reads);
  // No real network calls are needed for the enrichment fixture.
  t.mock.method(global, 'fetch', () => {
    assert.fail('Unexpected HTTP request');
  });
  const getTrackHistory = t.mock.method(
    ai,
    'getTrackHistoricalInfo',
    async () => 'Circuit history',
  );
  t.mock.method(
    wikipedia,
    'fetchCircuitImage',
    async () => 'https://example.com/image',
  );
  const { fetchAllF1Data } = require('../src/f1DataService');

  const data = await fetchAllF1Data();
  assert.equal(data.round, 2);
  assert.equal(data.sessions.race, '2026-05-15T12:00:00Z');
  assert.equal(data.weekendFormat, 'regular');
  assert.equal(data.circuitImageUrl, 'https://example.com/image');
  assert.deepEqual(
    data.trackHistory.map(({ lang }) => lang),
    ['en', 'he'],
  );
  assert.deepEqual(data.historicalRaceStats, [
    {
      season: 2016,
      winner: 'Test Driver 1',
      constructor: 'Fixture Team',
      polePosition: 'Test Driver 1',
      poleConstructor: 'Fixture Team',
      secondPlaceDriver: 'Test Driver 2',
      secondPlaceConstructor: 'Fixture Team',
      thirdPlaceDriver: 'Test Driver 3',
      thirdPlaceConstructor: 'Fixture Team',
      carsFinished: 3,
    },
  ]);
  assert.equal(reads.mock.callCount(), 11);

  failingSeason = 2025;
  failure = 'missing';
  await assert.rejects(fetchAllF1Data(), /BlobNotFound/);
  failure = 'truncated';
  await assert.rejects(fetchAllF1Data(), /Incomplete Jolpica season results/);
  assert.equal(getTrackHistory.mock.callCount(), 2);
});
