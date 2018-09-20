// Assign defaults to process.env, but don't override existing values if they
// are already set in the environment.
const defaults = Object.assign({
  NODE_ENV: 'test',
  APP_URL: 'https://test-github-app-instance.com',
  ATLASSIAN_URL: 'https://test-atlassian-instance.net',
  ATLASSIAN_SECRET: 'test-secret',
  PRIVATE_KEY_PATH: './test/setup/test-key.pem',
  GITHUB_CLIENT_SECRET: 'test-github-secret',
  LOG_LEVEL: 'fatal',
  // Don't worry about this key. It is just for testing.
  // Generate a secure, random one with `openssl rand -hex 32` in your .env file
  STORAGE_SECRET: '8cad66340bc92edbae2ae3a792d351f48c61d1d8efe7b2d9408b0025c1f7f845',
  SETUP: 'yes' // indicates that the setup did run
}, process.env)

Object.assign(process.env, defaults)
