FROM node:22-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install app dependencies (if any were added in package.json)
RUN npm install --omit=dev --ignore-scripts

# Copy application source code
COPY index.js ./
COPY src ./src

# Command to run the application
CMD ["node", "index.js"]