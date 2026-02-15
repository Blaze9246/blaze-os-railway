FROM node:18-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ENV PORT=3000
EXPOSE ${PORT}

CMD ["node", "api/index.js"]
