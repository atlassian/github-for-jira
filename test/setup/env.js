// Assign defaults to process.env, but don't override existing values if they
// are already set in the environment.
const defaults = Object.assign({
  NODE_ENV: 'test',
  APP_URL: 'https://test-github-app-instance.com',
  ATLASSIAN_URL: 'https://test-atlassian-instance.net',
  ATLASSIAN_SECRET: 'test-secret',
  PRIVATE_KEY_PATH: './test/setup/test-key.pem'
}, process.env)

Object.assign(process.env, defaults)
