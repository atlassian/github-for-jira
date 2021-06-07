import statsd from "../../src/config/statsd";
import { sequelize } from "../../src/models";

export default async () => {
  // TODO: probably missing things like redis and other things that need to close down
  // Close connection when tests are done
  await sequelize.close();
  // stop only if setup did run. If using jest --watch and no tests are matched
  // we need to not execute the require() because it will fail
  // TODO: fix wrong typing for statsd
  statsd.close(jest.fn());
};
