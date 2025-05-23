# F1 Next Race Info

A Node.js application that fetches Formula 1 race information from multiple APIs, processes it, and outputs detailed race data in JSON format. The application runs in a Docker container and provides information about the next F1 race, including session times, weekend format, and historical race results.

## Features

- Fetches next race details (circuit info, session times, location)
- Determines weekend format (regular/sprint)
- Collects historical race data (winners and finishers) for the last decade
- Outputs structured JSON data both to file and console
- Runs in a containerized environment

## Prerequisites

- Docker installed on your system
- Internet connection to access the F1 APIs

## Installation & Usage

1. Clone the repository:

```bash
git clone <repository-url>
cd f1-fantasy-next-race-info
```

2. Build the Docker image:

```bash
docker build -t f1-fantasy-next-race-info .
```

3. Run the application:

```bash
docker run --rm -v ${PWD}:/usr/src/app f1-fantasy-next-race-info
```

The application will:

- Fetch data from all required APIs
- Process and combine the data
- Create/update `output.json` in the project root directory
- Print the formatted JSON to the console

## API Endpoints Used

1. Next Race Data:

   ```
   https://api.jolpi.ca/ergast/f1/current/next.json
   ```

2. Sprint Weekend Check:

   ```
   https://api.jolpi.ca/ergast/f1/<season>/<round>/sprint.json
   ```

3. Historical Results:
   ```
   https://api.jolpi.ca/ergast/f1/{year}/circuits/{circuitId}/results.json
   ```

## Output Format

The application generates a JSON file (`output.json`) with the following structure:

```json
{
  "circuitId": "string",
  "raceName": "string",
  "round": number,
  "season": number,
  "circuitName": "string",
  "location": {
    "lat": "string",
    "long": "string",
    "locality": "string",
    "country": "string"
  },
  "sessions": {
    "firstPractice": "ISO-8601 datetime string",
    "qualifying": "ISO-8601 datetime string",
    "race": "ISO-8601 datetime string"
    // Optional sessions (only included when applicable):
    // "secondPractice": "ISO-8601 datetime string",
    // "thirdPractice": "ISO-8601 datetime string",
    // "sprint": "ISO-8601 datetime string",
    // "sprintQualifying": "ISO-8601 datetime string"
  },
  "weekendFormat": "regular" | "sprint",
  "historicalData": [
    {
      "season": number,
      "winner": "string",
      "carsFinished": number
    }
  ]
}
```

Note: The `sessions` object only includes sessions that are scheduled for the race weekend. Sessions that don't exist for a particular weekend format are omitted from the output rather than showing as null.

## Project Structure

- `index.js` - Main application logic
- `package.json` - Project configuration
- `Dockerfile` - Container configuration
- `.dockerignore` - Docker build exclusions
- `output.json` - Generated data file (created when the application runs)

## Error Handling

The application includes basic error handling for:

- Failed API requests
- Missing or invalid data in API responses
- File system operations

If an error occurs, the application will:

1. Log the error to the console
2. Exit with status code 1

## Development

To modify the application:

1. Update the source code in `index.js`
2. Rebuild the Docker image:

```bash
docker build -t f1-fantasy-next-race-info .
```

3. Run the container to test your changes:

```bash
docker run --rm -v ${PWD}:/usr/src/app f1-fantasy-next-race-info
```

## License

ISC

## Contributing

Feel free to submit issues and enhancement requests!
