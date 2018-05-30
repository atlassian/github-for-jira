const secrets = {
  [process.env.ATLASSIAN_URL]: process.env.ATLASSIAN_SECRET
}

/*
 * This will need to be replaced with a call out to a database
 * of shared secrets for Jira. Pending infrastructure, we use a
 * simple associative array for testing.
 */
module.exports = function getJiraDetails (config, repository) {
  return {
    secret: secrets[config.jira],
    baseURL: config.jira
  }
}
