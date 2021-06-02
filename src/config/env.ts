import dotenv from 'dotenv';
const env = dotenv.config();
if (env.error) {
  throw env.error
}

export default env.parsed
