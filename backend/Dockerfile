# TradeLab backend — runs the TypeScript API via ts-node (matches `npm run start`).
FROM node:20-alpine

WORKDIR /app

# Install deps first for better layer caching. ts-node/typescript live in
# devDependencies, so a full install (not --production) is required.
COPY package*.json ./
RUN npm install

# App source
COPY . .

EXPOSE 5000

CMD ["npm", "run", "start"]
