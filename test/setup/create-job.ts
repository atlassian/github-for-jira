// Create a job stub with data
export default ({ data, opts }) => {
  const defaultOpts = {
    attempts: 3,
    removeOnFail: true,
    removeOnComplete: true,
  };

  return {
    data,
    opts: Object.assign(defaultOpts, opts || {}),
    sentry: { setUser: () => undefined },
  };
};
