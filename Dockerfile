
FROM node:22-alpine AS base
WORKDIR /app

COPY package*.json ./

FROM base AS development

RUN npm ci

RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]


FROM base AS builder
COPY . .
RUN npm ci && \
    npm run build 


FROM node:22-alpine AS production
WORKDIR /app


ENV NODE_ENV=production
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont
RUN mkdir -p error-log && chown -R node:node /app

COPY --from=builder --chown=node:node /app/package*.json ./
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/node_modules ./node_modules

USER node


EXPOSE 3000
CMD ["node", "dist/main.js"]