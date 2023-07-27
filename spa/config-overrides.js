//https://stackoverflow.com/questions/70591567/module-not-found-error-cant-resolve-fs-in-react
module.exports = function override(config, env) {
  console.log("React app rewired works!")
  config.resolve.fallback = {
    "@atlassiansox/analytics-web-client": false
  };
  return config;
};
