/*
 * Copied from https://github.com/maxogden/github-oauth/blob/master/index.js
 * But it had a vulnerability on the `request` package version range.
 * So, instead of making a fork, since it's only one file and the package
 * hasn't been updated in 3 years I thought it was simpler to just copy the source here
 */
const request = require('request');
const crypto = require('crypto');
const url = require('url');

const host = process.env.GHE_HOST || 'github.com';

module.exports = function (opts) {
  if (!opts.callbackURI) opts.callbackURI = '/github/callback';
  if (!opts.loginURI) opts.loginURI = '/github/login';
  if (!opts.scope) opts.scope = 'user repo';
  const redirectURI = new URL(opts.callbackURI, opts.baseURL).toString();

  function addRoutes(router, loginCallback) {
    // compatible with flatiron/director
    router.get(opts.loginURI, (res, req) => login(res, req));
    router.get(opts.callbackURI, callback);
  }

  function login(req, res, redirectUrl) {
    // TODO: We really should be using an Auth library for this, like @octokit/github-auth
    // Create unique state for each oauth request
    const state = crypto.randomBytes(8).toString('hex');
    // Save the redirect that may have been specified earlier into session to be retrieved later
    req.session[state] = redirectUrl || res.locals.redirect || `/github/configuration${url.parse(req.originalUrl).search || ''}`;
    return res.redirect(`https://${host}/login/oauth/authorize?client_id=${opts.githubClient}${opts.scope ? `&scope=${opts.scope}` : ''}&redirect_uri=${redirectURI}&state=${state}`);
  }

  function callback(req, res, next) {
    const { query } = url.parse(req.url, true);
    const {
      code,
      state,
    } = query;

    // Take save redirect url and delete it from session
    const redirectUrl = req.session[state];
    delete req.session[state];

    // Check if state is available and matches a previous request
    if (!state || !redirectUrl) return next(new Error('Missing matching Auth state parameter'));
    if (!code) return next(new Error('Missing OAuth Code'));

    request.get({
      url: `https://${host}/login/oauth/access_token?client_id=${opts.githubClient}&client_secret=${opts.githubSecret}&code=${code}&state=${state}`,
      json: true,
    }, (err, tokenResp, body) => {
      if (err) {
        return next(new Error('Cannot retrieve access token from Github'));
      }
      req.session.githubToken = body.access_token;
      return res.redirect(redirectUrl);
    });
  }

  function checkGithubAuth(req, res, next) {
    if (!req.session.githubToken) {
      return login(req, res, req.originalUrl);
    }
    return next();
  }

  return {
    addRoutes,
    checkGithubAuth,
  };
};
