// Static mapping between Jolpi.ca race names and Google Sheet race names
const RACE_NAME_MAPPING = {
  // European Races
  'Italian Grand Prix': 'Italy',
  'British Grand Prix': 'Great Britain',
  'Emilia Romagna Grand Prix': 'Emilia-Romagna',
  'Spanish Grand Prix': 'Spain',
  'Monaco Grand Prix': 'Monaco',
  'Belgian Grand Prix': 'Belgium',
  'Dutch Grand Prix': 'Netherlands',
  'Austrian Grand Prix': 'Austria',
  'French Grand Prix': 'France',
  'Hungarian Grand Prix': 'Hungary',
  'Portuguese Grand Prix': 'Portugal',
  'German Grand Prix': 'Germany',
  'Russian Grand Prix': 'Russia',

  // Americas
  'United States Grand Prix': 'USA',
  'Brazilian Grand Prix': 'Brazil',
  'Mexican Grand Prix': 'Mexico',
  'Canadian Grand Prix': 'Canada',
  'Miami Grand Prix': 'Miami',
  'Las Vegas Grand Prix': 'Las Vegas',

  // Asia Pacific
  'Japanese Grand Prix': 'Japan',
  'Singapore Grand Prix': 'Singapore',
  'Australian Grand Prix': 'Australia',
  'Chinese Grand Prix': 'China',
  'Bahrain Grand Prix': 'Bahrain',
  'Saudi Arabian Grand Prix': 'Saudi Arabia',
  'Qatar Grand Prix': 'Qatar',
  'Korean Grand Prix': 'Korea',
  'Malaysian Grand Prix': 'Malaysia',
  'Indian Grand Prix': 'India',

  // Middle East/Africa
  'Abu Dhabi Grand Prix': 'Abu Dhabi',
  'Turkish Grand Prix': 'Turkey',

  // Street circuits and special cases
  'Azerbaijan Grand Prix': 'Azerbaijan',
  'Styrian Grand Prix': 'Austria', // Special case - Styrian GP was held at Red Bull Ring (Austria)
  '70th Anniversary Grand Prix': 'Great Britain', // Special case - held at Silverstone
  'Eifel Grand Prix': 'Germany', // Special case - held at Nürburgring
  'Tuscan Grand Prix': 'Italy', // Special case - held at Mugello
  'Sakhir Grand Prix': 'Bahrain', // Special case - alternative layout at Bahrain
};

/**
 * Maps a Jolpi.ca race name to the corresponding Google Sheet race name
 * @param {string} jolpiRaceName - The race name from Jolpi.ca API
 * @returns {string|null} - The corresponding sheet race name, or null if no mapping found
 */
function getSheetRaceName(jolpiRaceName) {
  if (!jolpiRaceName || typeof jolpiRaceName !== 'string') {
    return null;
  }

  return RACE_NAME_MAPPING[jolpiRaceName] || null;
}

/**
 * Gets all available race name mappings
 * @returns {Object} - Object with all race name mappings
 */
function getAllMappings() {
  return { ...RACE_NAME_MAPPING };
}

/**
 * Checks if a Jolpi.ca race name has a mapping
 * @param {string} jolpiRaceName - The race name from Jolpi.ca API
 * @returns {boolean} - True if mapping exists, false otherwise
 */
function hasMappingForRace(jolpiRaceName) {
  return (
    jolpiRaceName &&
    Object.prototype.hasOwnProperty.call(RACE_NAME_MAPPING, jolpiRaceName)
  );
}

module.exports = {
  getSheetRaceName,
  getAllMappings,
  hasMappingForRace,
};
