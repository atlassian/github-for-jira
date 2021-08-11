/*
 * Copied from https://github.com/maxogden/github-oauth/blob/master/index.js
 * But it had a vulnerability on the `request` package version range.
 * So, instead of making a fork, since it's only one file and the package
 * hasn't been updated in 3 years I thought it was simpler to just copy the source here
 */
const request = require('request');
const crypto = require('crypto');
const url = require('url');
const { Installation } = require('../models');
const { AppSecrets } = require('../models');
const { getLog } = require('../config/logger');

let logger = getLog();

let host = 'github.com';

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

  async function login(req, res, redirectUrl) {
    const jiraHost = (req.query && req.query.xdm_e) || (req.body && req.body.jiraHost);

    if (!jiraHost) {
      console.log('Jira Host url is missing');
      logger.error('Jira Host url is missing');
      return;
    }

    const installation = await Installation.getForHost(jiraHost);
    if (process.env.GITHUB_INSTANCE === 'ghae') {
      const githubHost = (req.query && req.query.githubHost);
      // githubHost will be available in query only for Add Organization from GHAE
      if (githubHost && !installation.githubHost) {
        Installation.updateGithubHost({ githubHost, jiraHost });
      }
      host = githubHost || installation.githubHost;
      const ghaeInstanceData = await AppSecrets.getForHost(host);
      if (ghaeInstanceData) {
        opts.githubClient = ghaeInstanceData.clientId;
      }
    } else {
      // this will be executed for add org from dotcom
      if (!installation.githubHost) {
        Installation.updateGithubHost({ githubHost: host, jiraHost });
      }
    }

    // TODO: We really should be using an Auth library for this, like @octokit/github-auth
    // Create unique state for each oauth request
    const state = crypto.randomBytes(8).toString('hex');
    // Save the redirect that may have been specified earlier into session to be retrieved later
    req.session[state] = redirectUrl || res.locals.redirect || `/github/configuration${url.parse(req.originalUrl).search || ''}`;
    return res.redirect(`https://${host}/login/oauth/authorize?client_id=${opts.githubClient}${opts.scope ? `&scope=${opts.scope}` : ''}&redirect_uri=${redirectURI}&state=${state}`);
  }

  async function callback(req, res, next) {
    const { query } = url.parse(req.url, true);
    const {
      code,
      state,
    } = query;

    // Take save redirect url and delete it from session
    const redirectUrl = req.session[state];
    delete req.session[state];

    // Check if state is available and matches a previous request
    if (!state || !redirectUrl) {
      console.log('Missing matching Auth state parameter');
      logger.error('Missing matching Auth state parameter');
      return next(new Error('Missing matching Auth state parameter'));
    }
    if (!code) {
      console.log('Missing OAuth Code');
      logger.error('Missing OAuth Code');
      return next(new Error('Missing OAuth Code'));
    }

    if (process.env.GITHUB_INSTANCE === 'ghae') {
      const { query: queryparam } = url.parse(redirectUrl, true);
      let { githubHost: host, xdm_e: jiraHost } = queryparam;
      if (!host) {
        const installation = await Installation.getForHost(jiraHost);
        host = installation.githubHost;
      }
      const ghaeInstanceData = await AppSecrets.getForHost(host);
      if (ghaeInstanceData) {
        opts.githubClient = ghaeInstanceData.clientId;
        opts.githubSecret = ghaeInstanceData.clientSecret;
      }
    }

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
