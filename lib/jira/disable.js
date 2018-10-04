module.exports = async (req, res) => {
  req.log('App disabled on Jira.')

  const { installation } = res.locals
  await installation.disable()

  return res.sendStatus(204)
}
