// Fetch data from the F1 APIs and generate JSON output

const JOLPI_API_BASE = 'https://api.jolpi.ca/ergast/f1';
const OPENF1_API_BASE = 'https://api.openf1.org';

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
async function fetchRaceInterruptionData(year, raceName) {
  const meetingsUrl = `${OPENF1_API_BASE}/v1/meetings?meeting_name=${encodeURIComponent(raceName)}&year=${year}`;
  let meetingKey = null;

  try {
    const meetingsResp = await fetch(meetingsUrl);
    if (!meetingsResp.ok) return { safetyCarDeployments: null, redFlags: null };
    const meetings = await meetingsResp.json();

    // Normalize and match meeting_name to raceName
    const meeting = meetings.find(
      (m) =>
        m.meeting_name &&
        m.meeting_name.toLowerCase().includes(raceName.toLowerCase()),
    );
    if (!meeting) return { safetyCarDeployments: null, redFlags: null };
    meetingKey = meeting.meeting_key;
  } catch {
    return { safetyCarDeployments: null, redFlags: null };
  }

  // Fetch session_key for the Race session
  let sessionKey = null;
  try {
    const sessionUrl = `${OPENF1_API_BASE}/v1/sessions?meeting_key=${meetingKey}&session_name=Race`;
    const sessionResp = await fetch(sessionUrl);
    if (!sessionResp.ok) return { safetyCarDeployments: null, redFlags: null };
    const sessions = await sessionResp.json();
    if (!Array.isArray(sessions) || sessions.length === 0)
      return { safetyCarDeployments: null, redFlags: null };
    // Find the session with session_name === "Race"
    const raceSession = sessions.find((s) => s.session_name === 'Race');
    if (!raceSession || !raceSession.session_key)
      return { safetyCarDeployments: null, redFlags: null };
    sessionKey = raceSession.session_key;
  } catch {
    return { safetyCarDeployments: null, redFlags: null };
  }

  // Fetch all Safety Car deployments (regular and virtual) by category only, using session_key
  let safetyCarDeployments = 0;
  try {
    const scUrl = `${OPENF1_API_BASE}/v1/race_control?session_key=${sessionKey}&category=SafetyCar`;
    const scResp = await fetch(scUrl);
    if (scResp.ok) {
      const scMsgs = await scResp.json();
      safetyCarDeployments = scMsgs.filter(
        (msg) => msg.message && msg.message.toUpperCase().includes('DEPLOYED'),
      ).length;
    } else {
      safetyCarDeployments = null;
    }
  } catch (err) {
    console.warn('Error fetching Safety Car deployments:', err);
  }

  // Fetch red flags using flag=RED
  let redFlags = null;
  try {
    const rfUrl = `${OPENF1_API_BASE}/v1/race_control?session_key=${sessionKey}&flag=RED`;
    const rfResp = await fetch(rfUrl);
    if (rfResp.ok) {
      const rfMsgs = await rfResp.json();
      redFlags = Array.isArray(rfMsgs) ? rfMsgs.length : null;
    } else {
      redFlags = null;
    }
  } catch (err) {
    console.warn('Error fetching Red Flags:', err);
  }

  return { safetyCarDeployments, redFlags };
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
  fetchRaceInterruptionData,
};
