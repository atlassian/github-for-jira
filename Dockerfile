FROM node:14.19-alpine3.15 as build

# adding python for node-gyp
RUN apk add g++ make python3

# adding to solve vuln
RUN apk add --update --upgrade busybox
RUN apk add --update --upgrade libretls
RUN apk add --update --upgrade openssl

COPY . /app
WORKDIR /app

#ARG YARNRC=.yarnrc
ADD .npmrc /root/
RUN rm -f /app/.npmrc

# Installing packages
RUN yarn install --frozen-lockfile --ignore-optional

#FROM node:14.19-alpine3.15
#WORKDIR /app
#COPY --from=builder /app .
CMD ["yarn", "start"]
