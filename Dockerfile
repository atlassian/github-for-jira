FROM node:14.21-alpine3.16 as build

# adding python for node-gyp
RUN apk add g++ make python3

# adding to solve vuln
RUN apk add --update --upgrade busybox libretls openssl zlib

# Update SSL certs
RUN apk add --update --upgrade --no-cache ca-certificates
RUN update-ca-certificates

# For debugging curl command
RUN apk add curl

COPY . /app
WORKDIR /app

# Installing packages
RUN yarn install --frozen-lockfile

CMD ["yarn", "start"]
