import url from 'url';
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redisUrl = url.parse(REDIS_URL);

let password;
if (redisUrl.auth?.split(':').length === 2) {
  password = redisUrl.auth.split(':')[1];
}

const db = redisUrl.pathname?.split('/') || [];

export default (connectionName: string): RedisInfo => ({
  redisUrl: REDIS_URL,
  redisOptions: {
    password,
    port: Number(redisUrl.port) || 6379,
    host: redisUrl.hostname,
    db: db.length >= 2 ? Number(db[1]) : 0,
    connectionName,
  },
});

interface RedisInfo {
  redisUrl: string;
  redisOptions: Redis.RedisOptions;
}


// File from micros:

// const url = require('url');

// const REDIS_URL = process.env.REDIS_BOTTLENECK_HOST || '127.0.0.1';
// const redisInfo = url.parse(REDIS_URL);
// const REDIS_PORT = process.env.REDIS_BOTTLENECK_PORT || redisInfo.port || 6379;

// /** @type {string} */
// let password = null;
// if (redisInfo.auth && redisInfo.auth.split(':').length === 2) {
//   password = redisInfo.auth.split(':')[1];
// }

// /**
//  * @param {string} connectionName - The name for the connection
//  * @returns {{REDIS_URL: string, redisOptions: import('ioredis').RedisOptions}}
//  */
// module.exports = (connectionName) => ({
//   REDIS_URL,
//   redisOptions: {
//     password,
//     port: REDIS_PORT,
//     host: REDIS_URL,
//     db: redisInfo.pathname ? redisInfo.pathname.split('/')[1] : 0,
//     connectionName,
//   },
// });
