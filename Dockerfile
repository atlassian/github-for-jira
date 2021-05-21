FROM node:slim

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 8080

ENTRYPOINT ["npm", "run", "start"]
