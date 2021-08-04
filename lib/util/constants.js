const GHAE_INSTANCE_URL_DEV = 'https://GitHubAEAccount.ghaekube.net';
const GHAE_INSTANCE_URL_PROD = 'https://GitHubAEAccount.ghe.com';

function getGhaeInstanceUrl() {
  if (process.env.NODE_ENV === 'production') return GHAE_INSTANCE_URL_PROD;
  else return GHAE_INSTANCE_URL_DEV;
}

module.exports = {
  GHAE_INSTANCE_URL: getGhaeInstanceUrl(),
};
