FROM node:24-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 8080
CMD ["sh", "-c", "node server/migrate.js && node server/index.js"]
