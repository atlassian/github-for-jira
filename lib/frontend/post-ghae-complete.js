const url = require('url');
const fetch = require('node-fetch');
const { AppSecrets, Registration } = require('../models');
const parseHost = require('../util/parse-host-from-url');
const lessThanOneHourAgo = require('../util/date-util');
const { getLog } = require('../config/logger');

module.exports = function (opts) {
  if (!opts.callbackURI) opts.callbackURI = '/githubAERegisterComplete';
  let logger = getLog();

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
      logger.error(`Request not coming from valid referer ${JSON.stringify(query)} - request ip ${req.ip}`);
      return res.status(400).render('ghae-register-error.hbs', {
        error: 'This is an invalid request, please start registration flow again',
      });
    }
    // Check state & code present in params
    if (!state) {
      logger.error(`Missing Auth state parameter ${JSON.stringify(query)} - request ip ${req.ip}`);
      return res.status(400).render('ghae-register-error.hbs', {
        error: 'Invalid response from GitHub AE account, unable to map to a registration request',
      });
    }
    if (!code) {
      logger.error(`Missing OAuth Code ${JSON.stringify(query)} - request ip ${req.ip}`);
      return res.status(400).render('ghae-register-error.hbs', {
        error: 'Invalid response from GitHub AE account, missing mandatory parameter',
      });
    }
    // retrive ghaeHost from state
    let registration = await Registration.getRegistration(state);
    // check valid state or not
    if (!registration) {
      logger.error(`Invalid Auth state parameter ${JSON.stringify(query)} - request ip ${req.ip}`);
      return res.status(401).render('ghae-register-error.hbs', {
        error: 'Invalid response from GitHub AE account, unable to map to a registration request',
      });
    }
    if (!lessThanOneHourAgo(registration.createdAt)) {
      logger.error(`Timeout, GitHub AE account took longer than expected time ${JSON.stringify(query)} - request ip ${req.ip}`);
      return res.status(401).render('ghae-register-error.hbs', {
        error: 'Timeout, GitHub AE account took longer than expected time. Please start registration flow again',
      });
    }

    let ghaeHost = parseHost(req.get('referer'));
    let githubHost = registration.githubHost;
    // check valid ghaehost
    if (githubHost !== ghaeHost) {
      logger.error(`Request not coming from valid GitHub AE instance ${JSON.stringify(query)} - request ip ${req.ip}`);
      return res.status(401).render('ghae-register-error.hbs', {
        error: 'This is an invalid request, please start registration flow again',
      });
    }
    // single app install allowed for particular host
    let appSecret = await AppSecrets.getForHost(githubHost);
    if (appSecret) {
      logger.error(`Jira App already exist for the given GitHub AE instance ${JSON.stringify(query)} - request ip ${req.ip}`);
      return res.status(409).render('ghae-register-error.hbs', {
        error: `The App is already registered on GitHub AE account - ${githubHost}`,
      });
    }
    let result = await getSecretsPostApi(githubHost, code);

    // remove registration as we have successfully validate state param
    await registration.remove();

    // validate we are getting id in the response & store app secrets in db
    if (result.id) {
      await storeAppSecrets(result);
    } else {
      logger.error(`Github Auth code invalidated ${JSON.stringify(query)} - request ip ${req.ip}`);
      return res.status(400).render('ghae-register-error.hbs', {
        error: 'Invalid response from GitHub AE account, missing mandatory parameters',
      });
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
      logger.error('Error:', error);
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

  return {
    addRoutes,
  };
};
