FROM node:12.18.1

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 8080

# Call Node directly instead of via `npm run start`, so that we are free to pass any NODE_OPTIONS we wish.
# (using the "--inspect" option would otherwise cause an "address already in use error", because it would try
# to create two debugging listeners - one for `npm` and one for the underlying `node` process.)
ENTRYPOINT ["node ./lib/run.js"]
