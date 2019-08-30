/*
 * An error wrapper that provides a more specific message for failed requests to the Jira API.
 */
class JiraClientError extends Error {
  constructor (error) {
    const { status, statusText } = error.response
    const { method, path } = error.response.request
    const message = `${method} ${path} responded with ${status} ${statusText}`

    super(message)

    this.response = error.response
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

module.exports = JiraClientError
