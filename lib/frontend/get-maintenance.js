module.exports = (req, res) => {
  // if getting showing page in Atlassian Marketplace, need to return 200 (default)
  // for the interceptor not to prevent the maintenance mode from showing.
  if (req.path !== '/jira/configuration' || !req.query.xdm_e || !req.query.jwt) {
    // Best HTTP status code for maintenance mode: https://en.wikipedia.org/wiki/List_of_HTTP_status_codes#5xx_server_errors
    res.status(503);
  }
  return res.render('maintenance.hbs', {
    title: 'Github for Jira - Under Maintenance',
    APP_URL: process.env.APP_URL,
    nonce: res.locals.nonce,
  });
};
