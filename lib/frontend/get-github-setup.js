module.exports = async (req, res, next) => {
  res.render('github-setup.hbs', {
    title: 'Setup'
  })
}
