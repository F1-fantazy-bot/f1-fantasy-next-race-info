FROM node:20-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install app dependencies (if any were added in package.json)
RUN npm install --omit=dev

# Copy application source code
COPY . .

# Command to run the application
CMD ["node", "index.js"]