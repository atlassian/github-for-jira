const parseSmartCommit = require('./smart-commit')

async function getLastCommit (payload, github) {
  const { ref } = payload
  const { owner: { login: owner }, name: repo } = payload.repository
  const { data: { object: sha } } = await github.repos.getReference({ owner, repo, ref })
  const { data } = await github.repos.getCommit({ owner, repo, sha })
  return {
    author: {
      name: data.author.name,
      email: data.author.email
    },
    authorTimestamp: data.author.date,
    displayId: sha.subString(0, 6),
    fileCount: 0,
    hash: sha,
    message: data.message,
    url: data.html_url
  }
}

module.exports = async (payload, github) => {
  if (payload.ref_type !== 'branch') return

  const { ref, repository } = payload

  const { issueKeys } = parseSmartCommit(ref)

  if (!issueKeys) {
    return
  }

  const lastCommit = getLastCommit(payload, github)

  return {
    data: {
      name: ref,
      createPullRequestUrl: `${repository.html_url}/pull/new/${ref}`,
      issueKeys,
      lastCommit,
      url: `${repository.html_url}/tree/${ref}`,
      updateSequenceId: Date.now()
    }
  }
}
