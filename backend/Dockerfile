FROM node:18-alpine

WORKDIR /app/backend

COPY package*.json ./
RUN npm ci --only=production

COPY src ./src
COPY .env ./.env

ENV NODE_ENV=production
EXPOSE 3001

CMD ["npm", "start"]
