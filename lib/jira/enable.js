module.exports = async (req, res) => {
  req.log('App enabled on Jira.')

  const { installation } = res.locals
  await installation.enable()

  return res.sendStatus(204)
}
