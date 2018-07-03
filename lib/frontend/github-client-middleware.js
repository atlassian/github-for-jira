const octokit = require('@octokit/rest')

module.exports = (getAppToken) => {
  return (req, res, next) => {
    res.locals.github = octokit()

    if (req.session.githubToken) {
      res.locals.github.authenticate({
        type: 'token',
        token: req.session.githubToken
      })
    }

    const appClient = octokit()
    appClient.authenticate({
      type: 'app',
      token: getAppToken()
    })

    res.locals.client = appClient

    next()
  }
}
