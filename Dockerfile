FROM node:14.17-alpine as build

# adding python for node-gyp
RUN apk add g++ make python

COPY . /app
WORKDIR /app

# Installing packages
RUN npm ci

EXPOSE 4002

CMD ["npm", "start"]
