FROM node:18-alpine3.18 as build

# adding python for node-gyp
RUN apk add g++ make python3

# For coredumps
RUN apk add gdb
RUN apk add bash

# adding to solve vuln
RUN apk add --update --upgrade busybox libretls openssl zlib curl

COPY . /app
WORKDIR /app

# Installing packages
RUN cat ./package.json
RUN yarn install --frozen-lockfile

# If you are going to remove this, please make sure that it doesn't break existing GitHubServerApps:
#   1. create an API endpoint that calls all prod servers and checks for SSL checks in stg
#   2. deploy change without this line to stg
#   3. call the API endpoint again; compare results with the ones from #1
# Details:
#   https://github.com/nodejs/node/issues/16336#issuecomment-568845447
# ENV NODE_EXTRA_CA_CERTS=node_modules/node_extra_ca_certs_mozilla_bundle/ca_bundle/ca_intermediate_root_bundle.pem

CMD ["yarn", "start:no-spa"]
