const parseSmartCommit = require('./smart-commit')

function mapStatus ({ state, merged, merged_at }) {
  if (merged_at) {
    // pull request has a "merged_at" date
    return 'MERGED'
  }
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
  const { issueKeys } = parseSmartCommit(pull_request.title)

  if (!issueKeys) {
    return
  }

  return {
    data: {
      id: repository.id,
      name: repository.full_name,
      pullRequests: [
        {
          author: {
            avatar: author.avatar_url,
            name: author.login,
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
          url: pull_request.html_url,
          updateSequenceId: Date.now()
        }
      ],
      url: repository.url,
      updateSequenceId: Date.now()
    }
  }
}
