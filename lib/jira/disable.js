module.exports = async (req, res) => {
  const { installation } = res.locals
  await installation.disable()

  req.log(`Installation id=${installation.id} disabled on Jira`)

  return res.sendStatus(204)
}
