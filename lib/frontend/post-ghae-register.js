const crypto = require('crypto');
const url = require('url');
const { Registration } = require('../models');

module.exports = function (opts) {
  if (!opts.registerURI) opts.registerURI = '/register';
  app_url = process.env.APP_URL;

  // TODO: correct url, how to get app name
  manifest_data = JSON.stringify({
    name: 'Jira-App',
    url: 'https://github.com/apps/Jira-App',
    hook_attributes: {
      url: `${app_url}/github/events`,
    },
    redirect_url: `${app_url}/ghaeRegisterComplete/`,
    callback_urls: [
      `${app_url}/github/callback`,
    ],
    setup_url: `${app_url}/github/setup`,
    default_permissions: {
      issues: 'write',
      contents: 'read',
      metadata: 'read',
      pull_requests: 'write',
    },
    default_events: [
      'create',
      'commit_comment',
      'delete',
      'issue_comment',
      'issues',
      'pull_request',
      'pull_request_review',
      'pull_request_review_comment',
      'push',
      'workflow_run',
      'meta',
    ],
    public: false,
  });

  function addRoutes(router, loginCallback) {
    // compatible with flatiron/director
    router.post(opts.registerURI, (res, req) => register(res, req));
  }

  /*
    This function create randomebytes as state & store host, state mapping in db for validation.
    Sending manifest data to register app on GHAE
  */
  async function register(req, res, redirectUrl) {
    const { query } = url.parse(req.url, true);
    const { ghaeHost } = query;

    if (!ghaeHost || !validateGhaehost(ghaeHost)) {
      handleExceptions(res, 400, 'Invalid GHAE instance url');
      return;
    }

    const state = crypto.randomBytes(16).toString('hex');

    // save state and host for request validation
    const registration = await Registration.insert({ githubHost: ghaeHost, state });
    return res.json({
      manifest: manifest_data,
      state,
    });
  }

  function validateGhaehost(ghaeHost) {
    // TODO: validate ghae url based on certificates
    let ghaeUrlPattern = 'ghaekube.net';
    if (process.env.NODE_ENV === 'production') ghaeUrlPattern = 'ghe.com';
    if (ghaeHost.includes(ghaeUrlPattern)) return true;
    return false;
  }

  function handleExceptions(res, status, msg) {
    res.status(status);
    res.json({
      err: msg,
    });
  }

  return {
    addRoutes,
  };
};
