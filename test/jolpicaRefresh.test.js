const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  createJolpicaClient,
  fetchSeasonResults,
  refreshJolpicaCache,
} = require('../src/jolpicaRefresh');

const year = 2026;
const calendarKey = 'jolpica/calendar.json';
const latestKey = 'jolpica/results/2025.json';
const oldTimestamp = '2026-04-01T12:00:00.000Z';
const clock = () => new Date('2026-04-13T12:00:00Z');

function result(position) {
  return {
    position: String(position),
    grid: String(position),
    status: 'Finished',
    Driver: {
      driverId: `driver-${position}`,
      givenName: 'Test',
      familyName: `Driver ${position}`,
    },
    Constructor: { name: 'Test team' },
  };
}

function race(season, round, results) {
  return {
    season: String(season),
    round: String(round),
    raceName: 'Example Grand Prix',
    date: `${season}-05-01`,
    time: '15:00:00Z',
    Circuit: {
      circuitId: 'example',
      circuitName: 'Example Circuit',
      url: 'https://example.com',
      Location: {},
    },
    ...(results ? { Results: results } : {}),
  };
}

function page(season, races, total = races.length, offset = 0, limit = 100) {
  return {
    MRData: {
      total: String(total),
      limit: String(limit),
      offset: String(offset),
      RaceTable: { season: String(season), Races: races },
    },
  };
}

const results = [1, 2, 3, 4].map(result);
const firstPage = (season) =>
  page(season, [race(season, 1, results.slice(0, 3))], 8, 0, 3);
const secondPage = (season) =>
  page(
    season,
    [race(season, 1, results.slice(3)), race(season, 2, results.slice(0, 2))],
    8,
    3,
    3,
  );
const thirdPage = (season) =>
  page(season, [race(season, 2, results.slice(2))], 8, 6, 3);

function makeRun({
  calendarFailure,
  resultFailure,
  uploadFailure,
  missing,
  runClock = clock,
} = {}) {
  const previous = { etag: 'old', metadata: { fetchedat: oldTimestamp } };
  const stored = new Map([
    [calendarKey, 'old calendar'],
    [latestKey, 'old results'],
  ]);
  const uploads = [];
  const requests = [];
  const alerts = [];

  const fetchPage = async (path, offset = 0) => {
    requests.push([path, offset]);
    const season = Number(path.split(/[./]/)[0]);
    if (!path.endsWith('/results.json')) {
      if (calendarFailure === '504') {
        const client = createJolpicaClient({
          request: async () => new Response(null, { status: 504 }),
          wait: async () => {},
        });
        return client(path);
      }
      return page(
        season,
        [race(season, 1)],
        calendarFailure === 'truncated' ? 2 : 1,
      );
    }
    if (offset === 0) return firstPage(season);
    if (offset === 3) return secondPage(season);
    if (resultFailure) throw new Error('HTTP 504 on last results page');
    return thirdPage(season);
  };
  const run = () =>
    refreshJolpicaCache({
      clock: runClock,
      fetchPage,
      getProperties: async (blob) => (blob === missing ? null : previous),
      upload: async (contents, blob, options) => {
        if (uploadFailure === blob) throw new Error('Upload failed');
        assert.deepEqual(
          options.conditions,
          blob === missing ? { ifNoneMatch: '*' } : { ifMatch: 'old' },
        );
        uploads.push(blob);
        stored.set(blob, JSON.parse(contents));
      },
      alert: async (message) => alerts.push(message),
    });
  return { run, stored, uploads, alerts, requests };
}

test('reassembles results when two rounds share a page and both span pages', async () => {
  const pages = [firstPage(2025), secondPage(2025), thirdPage(2025)];
  const data = await fetchSeasonResults(
    2025,
    async (_, offset) => pages[offset / 3],
  );
  assert.equal(data.MRData.total, '8');
  assert.deepEqual(
    data.MRData.RaceTable.Races.map((entry) => entry.Results),
    [results, results],
  );
});

for (const calendarFailure of ['504', 'truncated']) {
  test(`preserves the previous calendar during a ${calendarFailure} and refreshes results`, async () => {
    const { run, stored, alerts } = makeRun({ calendarFailure });
    await assert.rejects(run(), /refresh failed/);
    assert.equal(stored.get(calendarKey), 'old calendar');
    assert.equal(stored.get(latestKey).MRData.total, '8');
    assert.equal(alerts.length, 1);
    assert.match(alerts[0], /jolpica\/calendar.json.*2026-04-01/);
  });
}

test('publishes the calendar before results and preserves results after a later page fails', async () => {
  const { run, stored, uploads, alerts } = makeRun({ resultFailure: true });
  await assert.rejects(run(), /last results page/);
  assert.deepEqual(uploads, [calendarKey]);
  assert.equal(stored.get(latestKey), 'old results');
  assert.equal(alerts.length, 1);
  assert.match(alerts[0], /results\/2025.json.*2026-04-01/);
});

test('preserves published data on upload failure and sends one combined alert', async () => {
  const { run, stored, alerts } = makeRun({
    uploadFailure: calendarKey,
    resultFailure: true,
  });
  await assert.rejects(run(), /Upload failed/);
  assert.equal(stored.get(calendarKey), 'old calendar');
  assert.equal(stored.get(latestKey), 'old results');
  assert.equal(alerts.length, 1);
  assert.match(alerts[0], /calendar.json/);
  assert.match(alerts[0], /results\/2025.json/);
});

test('keeps the previous results when an upload fails after all pages validate', async () => {
  const { run, stored, uploads, alerts } = makeRun({
    uploadFailure: latestKey,
  });
  await assert.rejects(run(), /Upload failed/);
  assert.deepEqual(uploads, [calendarKey]);
  assert.equal(stored.get(latestKey), 'old results');
  assert.equal(alerts.length, 1);
  assert.match(alerts[0], /results\/2025.json.*2026-04-01/);
});

test('backfills a missing year and refreshes the latest completed season', async () => {
  const missing = 'jolpica/results/2022.json';
  const { run, stored, uploads } = makeRun({ missing });
  await run();
  assert.deepEqual(uploads, [calendarKey, latestKey, missing]);
  assert.equal(stored.get(missing).fetchedAt, clock().toISOString());
});

test('uses the UTC season at rollover', async () => {
  const { run, stored, requests } = makeRun({
    runClock: () => new Date('2026-12-31T20:00:00-05:00'),
  });
  await run();
  assert.equal(stored.get(calendarKey).MRData.RaceTable.season, '2027');
  assert.deepEqual(requests.slice(0, 2), [
    ['2027.json', 0],
    ['2026/results.json', 0],
  ]);
});

test('respects Retry-After and spaces requests', async () => {
  let now = 0;
  const sent = [];
  const fetchPage = createJolpicaClient({
    now: () => now,
    wait: async (delay) => {
      now += delay;
    },
    request: async () => {
      sent.push(now);
      return sent.length === 1
        ? new Response(null, { status: 429, headers: { 'Retry-After': '2' } })
        : Response.json({});
    },
  });
  await fetchPage(`${year}.json`);
  await fetchPage('2025/results.json');
  assert.deepEqual(sent, [0, 2000, 2350]);
});

test('bounds retries for an extended upstream throttle', async () => {
  let requests = 0;
  const fetchPage = createJolpicaClient({
    now: () => 0,
    wait: async (delay) => assert.equal(delay, 0),
    request: async () => {
      requests++;
      return new Response(null, {
        status: 429,
        headers: { 'Retry-After': '3600' },
      });
    },
  });
  await assert.rejects(fetchPage(`${year}.json`), /HTTP 429/);
  await assert.rejects(fetchPage('2025/results.json'), /retry budget/);
  assert.equal(requests, 1);
});
