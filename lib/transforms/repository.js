function mapToJira(githubRepository, commits) {
  return {
    name: githubRepository.full_name,
    url: githubRepository.url,
    id: githubRepository.id,
    commits: commits
  }
}

module.exports = {
  mapToJira
}
