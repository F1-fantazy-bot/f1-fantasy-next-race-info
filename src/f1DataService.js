// Fetch data from the F1 APIs and generate JSON output

async function fetchNextRaceData() {
  try {
    const response = await fetch(
      'https://api.jolpi.ca/ergast/f1/current/next.json',
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch next race data: ${response.status}`);
    }
    const data = await response.json();

    // Extract the first (and only) race from the Races array
    const race = data.MRData.RaceTable.Races[0];
    if (!race) {
      throw new Error('No next race data available');
    }

    // Only include sessions that exist
    const sessions = {};
    if (race.FirstPractice) {
      sessions.firstPractice = `${race.FirstPractice.date}T${race.FirstPractice.time}`;
    }
    if (race.SecondPractice) {
      sessions.secondPractice = `${race.SecondPractice.date}T${race.SecondPractice.time}`;
    }
    if (race.ThirdPractice) {
      sessions.thirdPractice = `${race.ThirdPractice.date}T${race.ThirdPractice.time}`;
    }
    if (race.Sprint) {
      sessions.sprint = `${race.Sprint.date}T${race.Sprint.time}`;
    }
    if (race.SprintQualifying) {
      sessions.sprintQualifying = `${race.SprintQualifying.date}T${race.SprintQualifying.time}`;
    }
    if (race.Qualifying) {
      sessions.qualifying = `${race.Qualifying.date}T${race.Qualifying.time}`;
    }
    sessions.race = `${race.date}T${race.time}`;

    return {
      circuitId: race.Circuit.circuitId,
      raceName: race.raceName,
      round: Number(race.round),
      season: Number(race.season),
      circuitName: race.Circuit.circuitName,
      location: {
        lat: race.Circuit.Location.lat,
        long: race.Circuit.Location.long,
        locality: race.Circuit.Location.locality,
        country: race.Circuit.Location.country,
      },
      sessions,
    };
  } catch (error) {
    console.error('Error fetching next race data:', error);
    throw error;
  }
}

async function checkSprintWeekend(season, round) {
  try {
    const response = await fetch(
      `https://api.jolpi.ca/ergast/f1/${season}/${round}/sprint.json`,
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch sprint data: ${response.status}`);
    }
    const data = await response.json();

    // Return "sprint" for sprint weekends, "regular" for normal weekends
    return data.MRData.RaceTable.Races.length > 0 ? 'sprint' : 'regular';
  } catch (error) {
    console.error('Error checking sprint weekend:', error);
    throw error;
  }
}

async function fetchHistoricalResults(circuitId) {
  try {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 10;
    const endYear = currentYear - 1;
    const results = [];

    for (let year = startYear; year <= endYear; year++) {
      const response = await fetch(
        `https://api.jolpi.ca/ergast/f1/${year}/circuits/${circuitId}/results.json`,
      );
      if (!response.ok) {
        console.warn(`No data available for ${year}`);
        continue;
      }

      const data = await response.json();
      const race = data.MRData.RaceTable.Races[0];

      if (race && race.Results && race.Results.length > 0) {
        // Get the winner (first position)
        const winner = race.Results[0].Driver;
        const winnerName = `${winner.givenName} ${winner.familyName}`;

        // Count finished cars (including those that completed the race but weren't on the lead lap)
        const finishedCars = race.Results.filter(
          (result) =>
            result.status === 'Finished' || result.status.includes('Lap'),
        ).length;

        results.push({
          season: year,
          winner: winnerName,
          carsFinished: finishedCars,
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Error fetching historical results:', error);
    throw error;
  }
}

async function fetchAllF1Data() {
  const nextRaceData = await fetchNextRaceData();
  const weekendFormat = await checkSprintWeekend(
    nextRaceData.season,
    nextRaceData.round,
  );
  const historicalResults = await fetchHistoricalResults(
    nextRaceData.circuitId,
  );

  return {
    ...nextRaceData,
    weekendFormat,
    historicalData: historicalResults,
  };
}

module.exports = {
  fetchNextRaceData,
  checkSprintWeekend,
  fetchHistoricalResults,
  fetchAllF1Data,
};
