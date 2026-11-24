const { setTimeout: sleep } = require('node:timers/promises');
const {
  readBlobProperties,
  uploadJsonToBlob,
} = require('./azureBlobStorageService');
const {
  CALENDAR_BLOB,
  resultsBlob,
  assert,
  validateCalendar,
  validatePage,
  validateResults,
} = require('./jolpicaCache');

const API_BASE = 'https://api.jolpi.ca/ergast/f1';
const PAGE_SIZE = 100;
const MAX_ATTEMPTS = 3;
const MAX_RETRY_DELAY_MS = 60_000;

function retryDelay(response, now) {
  const header = response?.headers.get('Retry-After');
  if (!header) return 0;
  if (/^\d+$/.test(header)) return Number(header) * 1000;
  return Math.max(0, Date.parse(header) - now()) || 0;
}

function createJolpicaClient({
  request = fetch,
  wait = sleep,
  now = Date.now,
} = {}) {
  let nextRequestAt = 0;
  return async (path, offset = 0) => {
    if (nextRequestAt - now() > MAX_RETRY_DELAY_MS) {
      throw new Error('Jolpica Retry-After exceeds the refresh retry budget');
    }
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      await wait(Math.max(0, nextRequestAt - now()));
      // Each run is sequential. Space requests below the published burst limit.
      nextRequestAt = now() + 350;
      let response;
      let failure;
      try {
        response = await request(
          `${API_BASE}/${path}?limit=${PAGE_SIZE}&offset=${offset}`,
          {
            headers: {
              Accept: 'application/json',
              'User-Agent': 'f1-fantasy-jolpica-cache/1.0',
            },
            signal: AbortSignal.timeout(20_000),
          },
        );
        if (response.ok) return await response.json();
        failure = new Error(
          `Jolpica ${path} offset ${offset}: HTTP ${response.status}`,
        );
      } catch (error) {
        failure = error;
      }
      const retryable =
        !response ||
        response.ok ||
        response.status === 429 ||
        response.status >= 500;
      const requestedDelay = retryDelay(response, now);
      if (requestedDelay)
        nextRequestAt = Math.max(nextRequestAt, now() + requestedDelay);
      if (
        !retryable ||
        attempt === MAX_ATTEMPTS ||
        requestedDelay > MAX_RETRY_DELAY_MS
      ) {
        throw failure;
      }
      nextRequestAt = Math.max(
        nextRequestAt,
        now() + 1000 * 2 ** (attempt - 1),
      );
    }
  };
}

async function fetchSeasonResults(year, fetchPage) {
  const rounds = new Map();
  let metadata;
  let total;
  let offset = 0;
  do {
    const page = validatePage(
      await fetchPage(`${year}/results.json`, offset),
      year,
      offset,
    );
    total ??= page.total;
    metadata ??= page.mr;
    assert(
      page.total === total,
      'Jolpica results total changed during pagination',
    );
    let count = 0;
    for (const race of page.races) {
      assert(
        Array.isArray(race.Results) && race.Results.length > 0,
        'Empty Jolpica results page fragment',
      );
      const round = rounds.get(race.round);
      if (round) {
        assert(
          round.Circuit.circuitId === race.Circuit.circuitId &&
            round.raceName === race.raceName &&
            round.date === race.date &&
            Number(race.round) === rounds.size,
          'Inconsistent Jolpica round across result pages',
        );
        round.Results.push(...race.Results);
      } else {
        assert(
          Number(race.round) === rounds.size + 1,
          'Jolpica results round is out of sequence',
        );
        rounds.set(race.round, { ...race, Results: [...race.Results] });
      }
      count += race.Results.length;
    }
    assert(
      count === Math.min(page.limit, total - offset),
      'Truncated Jolpica results page',
    );
    offset += count;
  } while (offset < total);

  const data = {
    MRData: {
      ...metadata,
      limit: String(total),
      RaceTable: { ...metadata.RaceTable, Races: [...rounds.values()] },
    },
  };
  validateResults(data, year);
  return data;
}

async function refreshJolpicaCache({
  clock = () => new Date(),
  fetchPage = createJolpicaClient(),
  getProperties = readBlobProperties,
  upload = uploadJsonToBlob,
  alert,
} = {}) {
  const year = clock().getUTCFullYear();
  const failures = [];

  async function refresh(blob, load, onlyIfMissing = false) {
    let previous;
    try {
      previous = await getProperties(blob);
      if (previous && onlyIfMissing) return;
      const data = await load();
      const fetchedAt = clock().toISOString();
      await upload(JSON.stringify({ ...data, fetchedAt }), blob, {
        conditions: previous
          ? { ifMatch: previous.etag }
          : { ifNoneMatch: '*' },
        metadata: { fetchedat: fetchedAt },
      });
    } catch (error) {
      const lastSuccess =
        previous?.metadata?.fetchedat ||
        previous?.lastModified?.toISOString() ||
        (previous === null ? 'never' : 'unavailable');
      failures.push(
        `${blob} (last successful refresh: ${lastSuccess}): ${error.message || error.code || error.details?.errorCode || error.name}`,
      );
    }
  }

  await refresh(CALENDAR_BLOB, async () => {
    const data = await fetchPage(`${year}.json`);
    validateCalendar(data, year);
    return data;
  });

  for (let season = year - 1; season >= year - 10; season--) {
    await refresh(
      resultsBlob(season),
      () => fetchSeasonResults(season, fetchPage),
      season !== year - 1,
    );
  }

  if (failures.length > 0) {
    const summary = `Jolpica refresh failed:\n${failures.map((failure) => failure.slice(0, 320)).join('\n')}`;
    if (alert) await alert(summary);
    throw new Error(summary);
  }
}

module.exports = {
  createJolpicaClient,
  fetchSeasonResults,
  refreshJolpicaCache,
};
