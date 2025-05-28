// Fetch data from the F1 APIs and generate JSON output

const JOLPI_API_BASE = 'https://api.jolpi.ca/ergast/f1';
const OPENF1_API_BASE = 'https://api.openf1.org';
const { getTrackHistoricalInfo } = require('./azureOpenAiService');

async function fetchNextRaceData() {
  try {
    const response = await fetch(`${JOLPI_API_BASE}/current/next.json`);
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
      `${JOLPI_API_BASE}/${season}/${round}/sprint.json`,
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

/**
 * Fetches the number of safety car deployments (regular and virtual) and red flags
 * for a given year and race name using the OpenF1 API.
 * - Safety cars: Counts messages with category=SafetyCar containing "DEPLOYED" (case-insensitive).
 * - Red flags: Counts messages with flag=RED.
 */
/**
 * Fetches race interruption data from OpenF1 API
 * @param {number} year - The year of the race
 * @param {string} raceName - The name of the race
 * @returns {Promise<{safetyCarDeployments: number|null, redFlags: number|null}>}
 * @throws {Error} If year is invalid or raceName is empty
 */
async function fetchRaceInterruptionData(year, raceName) {
  const meetingKey = await getMeetingKey(year, raceName);
  if (!meetingKey) {
    return { safetyCarDeployments: null, redFlags: null };
  }

  const sessionKey = await getSessionKey(meetingKey);
  if (!sessionKey) {
    return { safetyCarDeployments: null, redFlags: null };
  }

  const [safetyCarData, redFlagData] = await Promise.allSettled([
    fetchSafetyCarData(sessionKey),
    fetchRedFlagData(sessionKey),
  ]);

  return {
    safetyCarDeployments:
      safetyCarData.status === 'fulfilled' ? safetyCarData.value : null,
    redFlags: redFlagData.status === 'fulfilled' ? redFlagData.value : null,
  };
}

async function fetchHistoricalResults(circuitId) {
  try {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 10;
    const endYear = currentYear - 1;
    const results = [];

    for (let year = startYear; year <= endYear; year++) {
      const response = await fetch(
        `${JOLPI_API_BASE}/${year}/circuits/${circuitId}/results.json`,
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
        const constructor = race.Results[0].Constructor.name;

        // Count finished cars (including those that completed the race but weren't on the lead lap)
        const finishedCars = race.Results.filter(
          (result) =>
            result.status === 'Finished' || result.status.includes('Lap'),
        ).length;

        // Fetch total SC/VSC deployments from OpenF1 using year and raceName
        let safetyCarDeployments = null;
        let redFlags = null;
        if (race.raceName) {
          try {
            const interruptionData = await fetchRaceInterruptionData(
              year,
              race.raceName,
            );
            safetyCarDeployments = interruptionData.safetyCarDeployments;
            redFlags = interruptionData.redFlags;
          } catch (err) {
            console.warn(
              `Failed to fetch race interruption data for ${year} ${race.raceName}`,
            );
          }
        }

        const resultObj = {
          season: year,
          winner: winnerName,
          constructor,
          carsFinished: finishedCars,
        };
        if (
          safetyCarDeployments !== null &&
          safetyCarDeployments !== undefined
        ) {
          resultObj.safetyCars = safetyCarDeployments;
        }
        if (redFlags !== null && redFlags !== undefined) {
          resultObj.redFlags = redFlags;
        }
        results.push(resultObj);
      }
    }

    // Order results by year descending
    return results.sort((a, b) => b.season - a.season);
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

  // Get track historical information using Azure OpenAI
  let trackHistory = null;
  try {
    trackHistory = await getTrackHistoricalInfo(
      nextRaceData.circuitName,
      nextRaceData.raceName,
      nextRaceData.location,
    );
  } catch (error) {
    console.warn('Failed to get track historical information:', error);
  }

  return {
    ...nextRaceData,
    weekendFormat,
    // todo: kilzi: change it to historicalResults
    historicalData: historicalResults,
    trackHistory,
  };
}

module.exports = {
  fetchNextRaceData,
  checkSprintWeekend,
  fetchHistoricalResults,
  fetchAllF1Data,
  fetchRaceInterruptionData,
};

/**
 * Helper function for API requests
 * @private
 */
async function fetchWithErrorHandling(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  return response.json();
}

/**
 * Helper function to get meeting key from OpenF1 API
 * @private
 */
async function getMeetingKey(year, raceName) {
  try {
    const url = `${OPENF1_API_BASE}/v1/meetings?meeting_name=${encodeURIComponent(raceName)}&year=${year}`;
    const meetings = await fetchWithErrorHandling(url);
    const meeting = meetings.find((m) =>
      m.meeting_name?.toLowerCase().includes(raceName.toLowerCase()),
    );
    return meeting?.meeting_key || null;
  } catch (error) {
    console.warn('Error fetching meeting key:', error);
    return null;
  }
}

/**
 * Helper function to get session key from OpenF1 API
 * @private
 */
async function getSessionKey(meetingKey) {
  try {
    const url = `${OPENF1_API_BASE}/v1/sessions?meeting_key=${meetingKey}&session_name=Race`;
    const sessions = await fetchWithErrorHandling(url);
    if (!Array.isArray(sessions) || sessions.length === 0) return null;

    const raceSession = sessions.find((s) => s.session_name === 'Race');
    return raceSession?.session_key || null;
  } catch (error) {
    console.warn('Error fetching session key:', error);
    return null;
  }
}

/**
 * Helper function to fetch safety car deployments
 * @private
 */
async function fetchSafetyCarData(sessionKey) {
  try {
    const url = `${OPENF1_API_BASE}/v1/race_control?session_key=${sessionKey}&category=SafetyCar`;
    const scMsgs = await fetchWithErrorHandling(url);
    return scMsgs.filter((msg) =>
      msg.message?.toUpperCase().includes('DEPLOYED'),
    ).length;
  } catch (error) {
    console.warn('Error fetching Safety Car deployments:', error);
    return null;
  }
}

/**
 * Helper function to fetch red flag data
 * @private
 */
async function fetchRedFlagData(sessionKey) {
  try {
    const url = `${OPENF1_API_BASE}/v1/race_control?session_key=${sessionKey}&flag=RED`;
    const rfMsgs = await fetchWithErrorHandling(url);
    return Array.isArray(rfMsgs) ? rfMsgs.length : null;
  } catch (error) {
    console.warn('Error fetching Red Flags:', error);
    return null;
  }
}
