const CALENDAR_BLOB = 'jolpica/calendar.json';
const resultsBlob = (year) => `jolpica/results/${year}.json`;
const SESSION_NAMES = [
  'FirstPractice',
  'SecondPractice',
  'ThirdPractice',
  'Qualifying',
  'Sprint',
  'SprintQualifying',
  'SprintShootout',
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseCount(value) {
  assert(
    /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)),
    'Invalid Jolpica pagination or round count',
  );
  return Number(value);
}

function validateDate(date, year) {
  const midnight = Date.parse(`${date}T00:00:00Z`);
  assert(
    typeof date === 'string' &&
      date.startsWith(`${year}-`) &&
      Number.isFinite(midnight) &&
      new Date(midnight).toISOString().slice(0, 10) === date,
    'Invalid Jolpica session date',
  );
}

function validateTime(time) {
  assert(
    time == null || /^([01]\d|2[0-3]):[0-5]\d:[0-5]\dZ$/.test(time),
    'Invalid Jolpica session time',
  );
}

function validateRace(race, year) {
  assert(
    race?.season === String(year) && race.raceName && race.Circuit?.circuitId,
    'Invalid Jolpica race identity',
  );
  assert(
    parseCount(race.round) > 0 && String(Number(race.round)) === race.round,
    'Invalid Jolpica round',
  );
  validateDate(race.date, year);
  validateTime(race.time);
}

function validatePage(data, year, offset) {
  const mr = data?.MRData;
  assert(
    mr?.RaceTable?.season === String(year) && Array.isArray(mr.RaceTable.Races),
    `Invalid Jolpica season ${year}`,
  );
  const total = parseCount(mr.total);
  const limit = parseCount(mr.limit);
  assert(
    parseCount(mr.offset) === offset && limit > 0 && total > offset,
    'Invalid Jolpica page range',
  );
  mr.RaceTable.Races.forEach((race) => validateRace(race, year));
  return { mr, total, limit, races: mr.RaceTable.Races };
}

function validateRounds(races) {
  const rounds = new Set(races.map((race) => Number(race.round)));
  assert(
    rounds.size === races.length &&
      races.every((race) => Number(race.round) <= rounds.size),
    'Jolpica rounds are duplicated or incomplete',
  );
}

function validateCalendar(data, year) {
  const { total, limit, races } = validatePage(data, year, 0);
  assert(
    total === races.length && total <= limit,
    'Incomplete Jolpica calendar',
  );
  validateRounds(races);
  for (const race of races) {
    assert(
      race.Circuit.circuitName && race.Circuit.Location && race.Circuit.url,
      'Missing Jolpica circuit details',
    );
    for (const name of SESSION_NAMES) {
      const session = race[name];
      if (session == null) continue;
      if (session.date != null) validateDate(session.date, year);
      validateTime(session.time);
    }
  }
  return races;
}

function validateResults(data, year) {
  const { total, limit, races } = validatePage(data, year, 0);
  validateRounds(races);
  let count = 0;
  for (const race of races) {
    assert(
      Array.isArray(race.Results) && race.Results.length >= 3,
      'Incomplete Jolpica round results',
    );
    const drivers = new Set();
    race.Results.forEach((result, index) => {
      assert(
        result.position === String(index + 1) &&
          /^\d+$/.test(result.grid) &&
          typeof result.status === 'string' &&
          result.Driver?.driverId &&
          result.Driver.givenName &&
          result.Driver.familyName &&
          result.Constructor?.name,
        'Invalid Jolpica race result',
      );
      assert(
        !drivers.has(result.Driver.driverId),
        'Duplicate Jolpica race result',
      );
      drivers.add(result.Driver.driverId);
    });
    count += race.Results.length;
  }
  assert(
    count === total && total <= limit,
    'Incomplete Jolpica season results',
  );
  return races;
}

module.exports = {
  CALENDAR_BLOB,
  resultsBlob,
  assert,
  validatePage,
  validateCalendar,
  validateResults,
};
