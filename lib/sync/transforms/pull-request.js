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

function getAuthor (author) {
  // If author is null, return the ghost user
  if (!author) {
    return {
      avatar: 'https://github.com/ghost.png',
      name: 'Deleted User',
      url: 'https://github.com/ghost'
    }
  }

  return {
    avatar: author.avatarUrl,
    name: author.login,
    url: author.url
  }
}
module.exports = (payload, author) => {
  // eslint-disable-next-line camelcase
  const { pull_request: pullRequest, repository } = payload
  const { issueKeys } = parseSmartCommit(pullRequest.title)

  if (!issueKeys) {
    return {}
  }

  return {
    data: {
      id: repository.id,
      name: repository.full_name,
      pullRequests: [
        {
          author: getAuthor(author),
          commentCount: pullRequest.comments.totalCount,
          destinationBranch: `${repository.html_url}/tree/${pullRequest.baseRef ? pullRequest.baseRef.name : ''}`,
          displayId: `#${pullRequest.number}`,
          id: pullRequest.number,
          issueKeys: issueKeys,
          lastUpdate: pullRequest.updatedAt,
          sourceBranch: `${pullRequest.headRef ? pullRequest.headRef.name : ''}`,
          sourceBranchUrl: `${repository.html_url}/tree/${pullRequest.headRef ? pullRequest.headRef.name : ''}`,
          status: mapStatus(pullRequest),
          timestamp: pullRequest.updatedAt,
          title: pullRequest.title,
          url: pullRequest.url,
          updateSequenceId: Date.now()
        }
      ],
      url: repository.html_url,
      updateSequenceId: Date.now()
    }
  }
}
