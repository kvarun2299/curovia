FROM node:22-alpine

ENV NODE_ENV=production PORT=3001
WORKDIR /app
COPY --chown=node:node . .
USER node
EXPOSE 3001

CMD ["node", "server.js"]