FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY relay-server.js .

EXPOSE 8080

USER node
CMD ["node", "relay-server.js"]
