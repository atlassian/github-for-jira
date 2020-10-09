/*
 * An error wrapper that provides a more specific message for failed requests to the Jira API.
 */
class JiraClientError extends Error {
  constructor(error) {
    const message = 'Error communicating with Jira DevInfo API';

    super(message);

    this.response = error.response;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = JiraClientError;
