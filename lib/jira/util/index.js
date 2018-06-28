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

  async function runJiraCommands (commands) {
    return Promise.all(commands.map(command => {
      if (command.kind === 'comment') {
        return Promise.all(command.issueKeys.map(issueKey => {
          return jiraClient.issues.comments.addForIssue(issueKey, {
            body: command.text
          })
        }))
      }

      if (command.kind === 'worklog') {
        return Promise.all(command.issueKeys.map(issueKey => {
          return jiraClient.issues.worklogs.addForIssue(issueKey, {
            timeSpentSeconds: command.time,
            comment: command.text
          })
        }))
      }

      if (command.kind === 'transition') {
        return Promise.all(command.issueKeys.map(async issueKey => {
          const transitions = (await jiraClient.issues.transitions.getForIssue(issueKey))
            .data
            .transitions
            .map(transition => ({
              id: transition.id,
              name: transition.name.replace(' ', '-').toLowerCase()
            }))
            .filter(transition => transition.name.startsWith(command.name))

          // We only want to run a transition if we match only one. If we don't match a transition
          // or if we match two transitions, we should resolve rather than transitioning.
          if (transitions.length !== 1) {
            return Promise.resolve()
          }

          if (command.text) {
            await jiraClient.issues.comments.addForIssue(issueKey, {
              body: command.text
            })
          }

          return jiraClient.issues.transitions.updateForIssue(issueKey, transitions[0].id)
        }))
      }
    }))
  }

  return {
    addJiraIssueLinks,
    runJiraCommands
  }
}
