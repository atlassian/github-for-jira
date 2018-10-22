const transformPullRequest = require('./transforms/pull-request')
const { getPullRequests: getPullRequestQuery } = require('./queries')

exports.getPullRequests = async (jiraClient, github, repository, cursor, perPage) => {
  const { edges } = (await github.query(getPullRequestQuery, {
    owner: repository.owner.login,
    repo: repository.name,
    per_page: perPage,
    cursor
  })).repository.pullRequests

  const pullRequests = edges.map(({ node: pull }) => {
    const { data } = transformPullRequest({ pull_request: pull, repository }, pull.author)
    return data && data.pullRequests[0]
  }).filter(Boolean)

  if (pullRequests.length > 0) {
    const jiraPayload = {
      id: repository.id,
      name: repository.full_name,
      pullRequests,
      url: repository.html_url,
      updateSequenceId: Date.now()
    }
    await jiraClient.devinfo.repository.update(jiraPayload)
  }

  return edges
}
