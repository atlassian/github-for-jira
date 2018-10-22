const transformCommit = require('../transforms/commit')
const { getCommits: getCommitsQuery } = require('./queries')

exports.getCommits = async (jiraClient, github, repository, cursor, perPage) => {
  const commitsData = await github.query(getCommitsQuery, {
    owner: repository.owner.login,
    repo: repository.name,
    per_page: perPage,
    cursor
  })

  // if the repository is empty, commitsData.repository.ref is null
  const { edges } = commitsData.repository.ref
    ? commitsData.repository.ref.target.history
    : { edges: [] }

  const authors = edges.map(({ node: item }) => item.author)
  const commits = edges.map(({ node: item }) => {
    // translating the object into a schema that matches our transforms
    return {
      author: item.author,
      authorTimestamp: item.authoredDate,
      fileCount: 0,
      sha: item.oid,
      message: item.message,
      url: item.url
    }
  })

  const { data } = transformCommit({ commits, repository }, authors)
  if (data) {
    await jiraClient.devinfo.repository.update(data)
  }

  return edges
}
