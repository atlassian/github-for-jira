exports.getRepositorySummary = (repo) => {
  return {
    id: repo.id,
    name: repo.name,
    full_name: repo.full_name,
    owner: { login: repo.owner.login },
    html_url: repo.html_url
  }
}
