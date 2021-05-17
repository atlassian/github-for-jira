/*
 * Copied from https://github.com/maxogden/github-oauth/blob/master/index.js
 * But it had a vulnerability on the `request` package version range.
 * So, instead of making a fork, since it's only one file and the package
 * hasn't been updated in 3 years I thought it was simpler to just copy the source here
 */
const request = require('request');
const events = require('events');
const crypto = require('crypto');
const url = require('url');

const host = process.env.GHE_HOST || 'github.com';

module.exports = function (opts) {
  if (!opts.callbackURI) opts.callbackURI = '/github/callback';
  if (!opts.loginURI) opts.loginURI = '/github/login';
  if (!opts.scope) opts.scope = 'user repo';
  const redirectURI = new URL(opts.callbackURI, opts.baseURL).toString();
  const emitter = new events.EventEmitter();

  function addRoutes(router, loginCallback) {
    // compatible with flatiron/director
    router.get(opts.loginURI, login);
    router.get(opts.callbackURI, callback);
    if (!loginCallback) return;
    emitter.on('error', (token, err, resp, tokenResp, req) => {
      loginCallback(err, token, resp, tokenResp, req);
    });
    emitter.on('token', (token, resp, tokenResp, req) => {
      loginCallback(false, token, resp, tokenResp, req);
    });
  }

  function login(req, res, redirectUrl) {
    // TODO: We really should be using an Auth library for this, like @octokit/github-auth
    // Create unique state for each oauth request
    const state = crypto.randomBytes(8).toString('hex');
    // Save the redirect that may have been specified earlier into session to be retrieved later
    req.session[state] = redirectUrl || res.locals.redirect;
    return res.redirect(`https://${host}/login/oauth/authorize?client_id=${opts.githubClient}${opts.scope ? `&scope=${opts.scope}` : ''}&redirect_uri=${redirectURI}&state=${state}`);
  }

  function callback(req, res, cb) {
    // const url = new URL(req.url);
    // const code = url.searchParams.get('code');
    // const state = url.searchParams.get('state');
    const { query } = url.parse(req.url, true);
    const { code, state } = query;
    // Check if state is available and matches a previous request
    if (!state || !req.session[state]) return emitter.emit('error', { error: 'missing matching state' }, res);
    if (!code) return emitter.emit('error', { error: 'missing oauth code' }, res);
    res.locals.redirect = req.session[state];
    const u = `https://${host}/login/oauth/access_token?client_id=${opts.githubClient}&client_secret=${opts.githubSecret}&code=${code}&state=${state}`;

    request.get({ url: u, json: true }, (err, tokenResp, body) => {
      if (err) {
        if (cb) {
          err.body = body;
          err.tokenResp = tokenResp;
          return cb(err);
        }
        return emitter.emit('error', body, err, res, tokenResp, req);
      }
      if (cb) {
        cb(null, body);
      }
      // TODO: Emit more information here like redirect url
      emitter.emit('token', body, res, tokenResp, req);
    });
  }

  function checkGithubAuth(req, res, next) {
    // res.locals.redirect = ;
    if (!res.session.githubToken) {
      return login(req, res, req.originalUrl);
    }
    // res.locals.redirect = `/github/configuration${url.parse(req.originalUrl).search || ''}`;
    next();
  }

  emitter.login = login;
  emitter.callback = callback;
  emitter.addRoutes = addRoutes;
  emitter.checkGithubAuth = checkGithubAuth;
  return emitter;
};
