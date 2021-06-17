FROM node:14.17-alpine as build

# adding python for node-gyp
RUN apk add g++ make python

COPY . /app
WORKDIR /app

# Installing packages
RUN npm ci

# Building TypeScript files
RUN npm run build:release

FROM node:14.17-alpine
USER node
COPY --chown=node:node --from=build /app /app
WORKDIR /app
ENV NODE_ENV production
EXPOSE 8080

CMD ["npm", "run", "start:production"]

