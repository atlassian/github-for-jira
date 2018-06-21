const jiraIssueReferenceRegex = /\[([A-Z]+-[0-9]+)\](?!\()/g

module.exports = function (jiraClient) {
  function addJiraIssueLinks (text, issues) {
    const issueMap = issues.reduce((issueMap, issue) => ({
      ...issueMap,
      [issue.key]: issue
    }), {})

    return text.replace(jiraIssueReferenceRegex, (match, issueKey) => {
      if (!issueMap[issueKey]) {
        return match
      }

      return `[${issueKey} ${issueMap[issueKey].fields.summary}](${jiraClient.baseURL}/browse/${issueKey})`
    })
  }

  return {
    addJiraIssueLinks
  }
}
