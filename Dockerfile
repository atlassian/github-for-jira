FROM node:12.18.1

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 8080

ENTRYPOINT ["npm", "run", "start"]
