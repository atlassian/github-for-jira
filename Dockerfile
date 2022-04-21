FROM node:14.19-alpine3.15 as build

# adding python for node-gyp
RUN apk add g++ make python3

# adding to solve vuln
RUN apk add --update --upgrade busybox

COPY . /app
WORKDIR /app

# Installing packages
RUN npm ci

CMD ["npm", "start"]
