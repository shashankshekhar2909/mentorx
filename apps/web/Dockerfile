FROM node:20-alpine AS base

WORKDIR /app

COPY package.json /app/package.json
RUN npm install

COPY . /app

EXPOSE 3000

FROM base AS dev
CMD ["npm", "run", "dev", "--", "-p", "3000"]

FROM base AS build
RUN npm run build

FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/.next /app/.next
COPY --from=build /app/public /app/public

EXPOSE 3000
CMD ["npm", "run", "start", "--", "-p", "3000"]
