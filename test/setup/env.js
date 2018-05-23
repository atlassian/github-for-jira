// Assign defaults to process.env, but don't override existing values if they
// are already set in the environment.
const defaults = Object.assign({
  NODE_ENV: 'test',
  ATLASSIAN_URL: 'https://test-atlassian-instance.net',
  ATLASSIAN_SECRET: 'test-secret'
}, process.env)

Object.assign(process.env, defaults)
