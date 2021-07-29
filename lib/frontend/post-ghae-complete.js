const url = require('url');
const fetch = require('node-fetch');
const { AppSecrets, Registration } = require('../models');
const parseHost = require('../util/parse-host-from-url');
const lessThanOneHourAgo = require('../util/date-util');

module.exports = function (opts) {
  if (!opts.callbackURI) opts.callbackURI = '/ghaeRegisterComplete';

  function addRoutes(router, loginCallback) {
    // compatible with flatiron/director
    router.get(opts.callbackURI, callback);
  }

  /*
    This function validates state & github host. Store app secrets in db
    & remove state, github host mapping(registration) after successful validation
  */
  async function callback(req, res, next) {
    const { query } = url.parse(req.url, true);
    const { code, state } = query;

    // check valid referer, needed to validate ghaehost
    if (!req.get('referer')) {
      handleExceptions(res, 400, 'Request not coming from valid referer');
      return;
    }
    // Check state & code present in params
    if (!state) {
      handleExceptions(res, 400, 'Missing Auth state parameter');
      return;
    }
    if (!code) {
      handleExceptions(res, 400, 'Missing OAuth Code');
      return;
    }
    // retrive ghaeHost from state
    let registration = await Registration.getRegistration(state);
    // check valid state or not
    if (!registration || !lessThanOneHourAgo(registration.createdAt)) {
      console.log(`Invalid Auth state parameter ${JSON.stringify(query)} - request ip ${req.ip}`);
      handleExceptions(res, 401, 'Invalid Auth state parameter');
      return;
    }
    let ghaeHost = parseHost(req.get('referer'));
    let githubHost = registration.githubHost;
    // check valid ghaehost
    if (githubHost !== ghaeHost) {
      handleExceptions(res, 401, 'Request coming from invalid host');
      return;
    }
    // single app install allowed for particular host
    let appSecret = await AppSecrets.getForHost(githubHost);
    if (appSecret) {
      handleExceptions(res, 409, 'App already exist for the given host');
      return;
    }
    let result = await getSecretsPostApi(githubHost, code);

    // remove registration as we have successfully validate state param
    await registration.remove();

    // validate we are getting id in the response & store app secrets in db
    if (result.id) {
      await storeAppSecrets(result);
    } else {
      handleExceptions(res, 400, 'Github Auth code invalidated');
      return;
    }

    return res.render('ghae_register_complete.hbs', {
      app: JSON.stringify(result),
    });
  }

  // this function make post call to ghae to get app secrets
  async function getSecretsPostApi(githubHost, code) {
    url_fetch = `https://${githubHost}/api/v3/app-manifests/${code}/conversions`;
    let result = await fetch(url_fetch, {
      method: 'POST',
      headers: {
        accept: 'application/vnd.github.v3+json',
      },
    }).then(response => response.json()).then(data => data).catch((error) => {
      console.error('Error:', error);
    });
    return result;
  }

  // this function store appsecrets in the db using post call response
  async function storeAppSecrets(result) {
    await AppSecrets.insert({
      clientId: result.client_id,
      clientSecret: result.client_secret,
      privateKey: result.pem,
      appId: result.id,
      githubHost: new URL(result.html_url).hostname,
      webhookSecret: result.webhook_secret,
    });
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
