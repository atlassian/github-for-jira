export default async () => {
  if (process.env.SETUP) {
    const {stop} = await import('../src/worker/main');
    const statsd = (await import('../src/config/statsd')).default;
    // stop only if setup did run. If using jest --watch and no tests are matched
    // we need to not execute the require() because it will fail
    await stop();
    // TODO: fix wrong typing for statsd
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    statsd.close();
  }
};
