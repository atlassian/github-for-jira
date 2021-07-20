const axios = require('axios').default;
const jwt = require('atlassian-jwt');
const url = require('url');
const statsd = require('../../config/statsd');

const JiraClientError = require('./jira-client-error');

const instance = process.env.INSTANCE_NAME;
const iss = `com.github.integration${instance ? `.${instance}` : ''}`;

/**
 * Middleware to create a custom JWT for a request.
 *
 * @param {string} secret - The key to use to sign the JWT
 */
function getAuthMiddleware(secret) {
  return (
    /**
     * @param {import('axios').AxiosRequestConfig} config - The config for the outgoing request.
     * @returns {import('axios').AxiosRequestConfig} Updated axios config with authentication token.
     */
    (config) => {
      const { query, pathname } = url.parse(config.url, true);

      const jwtToken = jwt.encode({
        ...getExpirationInSeconds(),
        iss,
        qsh: jwt.createQueryStringHash({
          method: config.method,
          originalUrl: pathname,
          query,
        }),
      }, secret);

      return {
        ...config,
        headers: {
          ...config.headers,
          Authorization: `JWT ${jwtToken}`,
        },
      };
    });
}

/**
 * Mapping of Jira Dev Error Codes to nice strings.
 *
 * See {@link https://developer.atlassian.com/cloud/jira/software/rest/#api-devinfo-0-10-bulk-post} for details on the API errors.
 */
const JiraErrorCodes = {
  400: 'Request had incorrect format.',
  401: 'Missing a JWT token, or token is invalid.',
  403: 'The JWT token used does not correspond to an app that defines the jiraDevelopmentTool module, or the app does not define the \'WRITE\' scope',
  413: 'Data is too large. Submit fewer devinfo entities in each payload.',
  429: 'API rate limit has been exceeded.',
};

/**
 * Middleware to enhance failed requests in Jira.
 *
 * @param {import('probot').Logger} logger - The probot logger instance
 */
function getErrorMiddleware(logger) {
  return (
    /**
     * Potentially enrich the promise's rejection.
     *
     * @param {import('axios').AxiosError} error - The error response from Axios
     * @returns {Promise<Error>} The rejected promise
     */
    (error) => {
      if (error.response) {
        const { status, statusText } = error.response || {};
        logger.debug({
          params: error.config.fields,
        }, `Jira request: ${error.request.method} ${error.request.path} - ${status} ${statusText}`);

        if (status in JiraErrorCodes) {
          logger.error(error.response.data, JiraErrorCodes[status]);
        }

        return Promise.reject(new JiraClientError(error));
      } else {
        return Promise.reject(error);
      }
    });
}

/**
 * Middleware to enhance successful requests in Jira.
 *
 * @param {import('probot').Logger} logger - The probot logger instance
 */
function getSuccessMiddleware(logger) {
  return (
    /**
     * DEBUG log the response info from Jira
     *
     * @param {import('axios').AxiosResponse} response - The response from axios
     * @returns {import('axios').AxiosResponse} The axios response
     */
    (response) => {
      logger.debug({
        params: response.config.fields,
      }, `Jira request: ${response.config.method.toUpperCase()} ${response.config.originalUrl} - ${response.status} ${response.statusText}\\n${JSON.stringify(response.data)}`);

      return response;
    });
}

/**
 * Enrich the Axios Request Config with a URL object.
 */
function getUrlMiddleware() {
  return (
    /**
     * @param {import('axios').AxiosRequestConfig} config - The outgoing request configuration.
     * @returns {import('axios').AxiosRequestConfig} The enriched axios request config.
     */
    (config) => {
      let { query, pathname, ...rest } = url.parse(config.url, true);
      config.fields = config.fields || {};

      for (const field in config.fields) {
        if (pathname.includes(`:${field}`)) {
          pathname = pathname.replace(`:${field}`, config.fields[field]);
        } else {
          query[field] = config.fields[field];
        }
      }

      config.fields.baseUrl = config.baseURL;

      return {
        ...config,
        originalUrl: config.url,
        url: url.format({
          ...rest,
          pathname,
          query,
        }),
      };
    });
}

/*
 * The Atlassian API uses JSON Web Tokens (JWT) for authentication along with
 * Query String Hashing (QSH) to prevent URL tampering. IAT, or issued-at-time,
 * is a Unix-style timestamp of when the token was issued. EXP, or expiration
 * time, is a Unix-style timestamp of when the token expires and must be no
 * more than three minutes after the IAT. Since our tokens are per-request and
 * short-lived, we use a timeout of 30 seconds.
 */
function getExpirationInSeconds() {
  const nowInSeconds = Math.floor(Date.now() / 1000);

  return {
    iat: nowInSeconds,
    exp: nowInSeconds + 30,
  };
}

/**
 * Enrich the config object to include the time that the request started.
 *
 * @param {import('axios').AxiosRequestConfig} config - The Axios request configuration object.
 * @returns {import('axios').AxiosRequestConfig} The enriched config object.
 */
const setRequestStartTime = (config) => {
  config.requestStartTime = new Date();
  return config;
};

/**
 * Extract the path name from a URL.
 *
 * @param {string} someUrl - The URL to operate on.
 * @returns {string} The path name attribute from the URL.
 */
const extractPath = (someUrl) => {
  if (someUrl) {
    const { pathname } = url.parse(someUrl);
    return pathname;
  }
};

/**
 * Submit statsd metrics on successful requests.
 *
 * @param {import('axios').AxiosResponse} response - The successful axios response object.
 * @returns {import('axios').AxiosResponse} The response object.
 */
const instrumentRequest = (response) => {
  const requestDurationMs = Number(new Date() - response.config.requestStartTime);
  const tags = {
    method: response.config.method.toUpperCase(),
    path: extractPath(response.config.originalUrl),
    status: response.status,
  };

  statsd.histogram('jira_request', requestDurationMs, tags);

  return response;
};

/**
 * Submit statsd metrics on failed requests.
 *
 * @param {import('axios').AxiosError} error - The Axios error response object.
 * @returns {Promise<Error>} a rejected promise with the error inside.
 */
const instrumentFailedRequest = (error) => {
  if (error.response) {
    instrumentRequest(error.response);
  } else {
    console.log('Error during Axios request has no response property:', error);
  }

  return Promise.reject(error);
};

/**
 * Atlassian API JWTs need to be generated per-request due to their use of
 * Query String Hashing (QSH) to prevent URL tampering. Unlike traditional JWTs,
 * QSH requires us to re-encode a JWT for each URL we request to. As a result,
 * it makes sense for us to simply create a new JWT for each request rather than
 * attempt to reuse them. This accomplished using Axios interceptors to
 * just-in-time add the token to a request before sending it.
 *
 * @param {string} baseURL - The base URL for the request.
 * @param {any} secret - TBD
 * @param {import('probot').Logger} logger - The probot logger
 * @returns {import('axios').AxiosInstance} A custom axios instance
 */
module.exports = (baseURL, secret, logger) => {
  const instance = axios.create({
    baseURL,
    timeout: +process.env.JIRA_TIMEOUT || 20000,
  });

  instance.interceptors.request.use(setRequestStartTime);
  instance.interceptors.response.use(instrumentRequest, instrumentFailedRequest);

  instance.interceptors.request.use(getAuthMiddleware(secret));
  instance.interceptors.request.use(getUrlMiddleware());

  instance.interceptors.response.use(
    getSuccessMiddleware(logger),
    getErrorMiddleware(logger),
  );

  return instance;
};

module.exports.extractPath = extractPath;
