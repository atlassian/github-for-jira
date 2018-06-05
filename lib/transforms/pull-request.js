const parseJiraIssueKeys = require('../jira/util/parse-jira-issue-keys')

function mapStatus({ state, merged }) {
  if (state === 'open') {
    return 'OPEN'
  } else if (state === 'closed' && merged) {
    return 'MERGED'
  } else if (state === 'closed' && !merged) {
    return 'DECLINED'
  } else {
    return 'UNKNOWN'
  }
}

module.exports = function mapToJira(payload) {
  const { pull_request } = payload

  const issueKeys = parseJiraIssueKeys(pull_request.title)

  if (!issueKeys) {
    return
  }

  return {
    name: payload.repository.full_name,
    url: payload.repository.url,
    id: payload.repository.id,
    pullRequests: [
      {
        author: {
          name: 'Joshua Starkey',
          email: 'joshua@testdouble.com'
        },
        issueKeys: issueKeys,
        commentCount: pull_request.comments,
        displayId: pull_request.number.toString(),
        id: pull_request.id.toString(),
        lastUpdate: pull_request.updated_at,
        sourceBranch: pull_request.head.repo.html_url + '/tree/' + pull_request.head.ref,
        destinationBranch: pull_request.base.repo.html_url + '/tree/' +pull_request.base.ref,
        status: mapStatus(pull_request),
        timestamp: pull_request.updated_at,
        title: pull_request.title,
        url: pull_request.html_url
      }
    ]
  }
}
