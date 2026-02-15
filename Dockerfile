FROM node:18-slim

WORKDIR /app

COPY package*.json ./
RUN rm -rf node_modules && npm ci

COPY . .

ENV PORT=3000
EXPOSE ${PORT}

CMD ["node", "index.js"]
