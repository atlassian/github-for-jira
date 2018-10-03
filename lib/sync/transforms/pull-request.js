const parseSmartCommit = require('../../transforms/smart-commit')

function mapStatus ({ state, merged }) {
  if (state === 'MERGED') {
    return 'MERGED'
  } else if (state === 'OPEN') {
    return 'OPEN'
  } else if (state === 'CLOSED' && merged) {
    return 'MERGED'
  } else if (state === 'CLOSED' && !merged) {
    return 'DECLINED'
  } else {
    return 'UNKNOWN'
  }
}

module.exports = (payload, author) => {
  // eslint-disable-next-line camelcase
  const { pull_request, repository } = payload
  const { issueKeys } = parseSmartCommit(pull_request.title)

  if (!issueKeys) {
    return {}
  }

  return {
    data: {
      id: repository.id,
      name: repository.full_name,
      pullRequests: [
        {
          author: {
            avatar: author.avatarUrl,
            name: author.login,
            url: author.url
          },
          commentCount: pull_request.comments.totalCount,
          destinationBranch: `${repository.html_url}/tree/${pull_request.baseRef ? pull_request.baseRef.name : ''}`,
          displayId: `#${pull_request.number}`,
          id: pull_request.number,
          issueKeys: issueKeys,
          lastUpdate: pull_request.updatedAt,
          sourceBranch: `${pull_request.headRef ? pull_request.headRef.name : ''}`,
          sourceBranchUrl: `${repository.html_url}/tree/${pull_request.headRef ? pull_request.headRef.name : ''}`,
          status: mapStatus(pull_request),
          timestamp: pull_request.updatedAt,
          title: pull_request.title,
          url: pull_request.url,
          updateSequenceId: Date.now()
        }
      ],
      url: repository.html_url,
      updateSequenceId: Date.now()
    }
  }
}
