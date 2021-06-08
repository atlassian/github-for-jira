import dotenv from "dotenv";
import path from "path";

const filename = process.env.NODE_ENV === "test" ? ".env.test" : ".env";
const env = dotenv.config({
  path: path.resolve(process.cwd(), filename)
});
if (env.error) {
  throw env.error;
}
export default env.parsed || {};
