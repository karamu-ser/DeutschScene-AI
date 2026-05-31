FROM node:18-alpine as build

WORKDIR /app/frontend

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:18-alpine
RUN npm install -g serve

WORKDIR /app

COPY --from=build /app/frontend/dist ./dist

EXPOSE 5173

CMD ["serve", "-s", "dist", "-l", "5173"]
