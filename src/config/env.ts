import dotenv from "dotenv";
import path from "path";
const nodeEnv = process.env.NODE_ENV;
const filename = nodeEnv === "test" ? ".env.test" : ".env";
const env = dotenv.config({
  path: path.resolve(process.cwd(), filename)
});
if (env.error && nodeEnv !== "production") {
  throw env.error;
}
export default env.parsed || {};
