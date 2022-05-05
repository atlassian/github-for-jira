FROM node:14.19-alpine3.15 as build

# adding python for node-gyp
RUN apk add g++ make python3

# adding to solve vuln
RUN apk add --update --upgrade busybox
RUN apk add --update --upgrade libretls
RUN apk add --update --upgrade openssl

COPY . /app
WORKDIR /app

# Installing packages
RUN yarn install --frozen-lockfile

CMD ["yarn", "start"]
