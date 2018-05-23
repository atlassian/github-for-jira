const secret = process.env.ATLASSIAN_SECRET
const baseURL = process.env.ATLASSIAN_URL

module.exports = function getJiraDetails () {
  return {
    secret,
    baseURL
  }
}
