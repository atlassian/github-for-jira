const jiraIssueRegex = /[A-Z]+-[0-9]+/g;

module.exports = function parseJiraIssueKeys(text) {
  return text.match(jiraIssueRegex);
};
