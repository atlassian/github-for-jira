/* eslint-disable @typescript-eslint/no-explicit-any */
// Create a job stub with data
// TODO: add better typings
export default ({ data, opts }:{data:any, opts?:any}) => {
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
