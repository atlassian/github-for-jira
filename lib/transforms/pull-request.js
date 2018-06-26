const parseJiraIssueReferences = require('../jira/util/parse-jira-issue-references')

function mapStatus ({ state, merged }) {
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

module.exports = (payload, author) => {
  // eslint-disable-next-line camelcase
  const { pull_request, repository } = payload
  const issueKeys = parseJiraIssueReferences(pull_request.title)

  if (!issueKeys) {
    return
  }

  return {
    name: repository.full_name,
    url: repository.url,
    id: repository.id,
    pullRequests: [
      {
        author: {
          name: author.login,
          avatar: author.avatar_url,
          url: author.html_url
        },
        commentCount: pull_request.comments,
        destinationBranch: `${pull_request.base.repo.html_url}/tree/${pull_request.base.ref}`,
        displayId: pull_request.number,
        id: pull_request.id,
        issueKeys: issueKeys,
        lastUpdate: pull_request.updated_at,
        sourceBranch: `${pull_request.head.repo.html_url}/tree/${pull_request.head.ref}`,
        status: mapStatus(pull_request),
        timestamp: pull_request.updated_at,
        title: pull_request.title,
        url: pull_request.html_url
      }
    ]
  }
}
