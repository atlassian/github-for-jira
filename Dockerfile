FROM node:14.17-alpine3.14 as build

# adding python for node-gyp
RUN apk add g++ make python

COPY . /app
WORKDIR /app

# Installing packages
RUN npm ci

CMD ["npm", "start"]
