import { stop } from "../../src/worker/main";
import statsd from "../../src/config/statsd";

export default async () => {
  if (process.env.SETUP) {
    // stop only if setup did run. If using jest --watch and no tests are matched
    // we need to not execute the require() because it will fail
    await stop();
    // TODO: fix wrong typing for statsd
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    statsd.close();
  }
};
