const OctokitError = require('../../lib/models/octokit-error');

describe(OctokitError, () => {
  const buildHttpError = ({ message, code, headers }) => {
    const error = new Error(message);

    error.code = code || 400;
    error.headers = headers || {};

    return error;
  };

  it('adds request metadata', () => {
    const error = buildHttpError({ code: 403, message: 'ServerError' });
    const requestOptions = {
      headers: { accept: 'application/vnd.github.v3+json' },
      method: 'GET',
      url: '/users/:username',
    };

    const octokitError = new OctokitError(error, requestOptions);

    expect(octokitError.sentryScope.extra.request).toEqual({
      method: 'GET',
      path: '/users/:username',
      headers: { accept: 'application/vnd.github.v3+json' },
    });
  });

  it('adds response metadata', () => {
    const requestOptions = {};
    const error = buildHttpError({
      code: 403,
      message: 'Server error',
      headers: { 'x-github-request-id': 'E553:6597:B5C6C1:1623C44:5D7192D1' },
    });

    const octokitError = new OctokitError(error, requestOptions);

    expect(octokitError.sentryScope.extra.response).toEqual({
      code: 403,
      body: 'Server error',
      headers: { 'x-github-request-id': 'E553:6597:B5C6C1:1623C44:5D7192D1' },
    });
  });

  it('deserializes JSON response body', () => {
    const requestOptions = {};
    const error = buildHttpError({
      message: JSON.stringify({
        message: 'API rate limit exceeded for installation ID 1339471.',
        documentation_url: 'https://developer.github.com/v3/#rate-limiting',
      }),
    });

    const octokitError = new OctokitError(error, requestOptions);

    expect(octokitError.sentryScope.extra.response.body).toEqual({
      message: 'API rate limit exceeded for installation ID 1339471.',
      documentation_url: 'https://developer.github.com/v3/#rate-limiting',
    });
  });

  it('sets the message', () => {
    const requestOptions = {
      method: 'GET',
      url: '/users/:username',
    };
    const error = buildHttpError({
      code: 401,
      message: JSON.stringify({
        message: 'API rate limit exceeded for installation ID 1339471.',
        documentation_url: 'https://developer.github.com/v3/#rate-limiting',
      }),
    });

    const octokitError = new OctokitError(error, requestOptions);
    expect(octokitError.message).toEqual('GET /users/:username responded with 401');
  });

  it('sets fingerprint using method, path, and response code', () => {
    const requestOptions = { method: 'GET', url: '/users/:username' };
    const error = buildHttpError({ code: 401, message: 'Server error' });

    const octokitError = new OctokitError(error, requestOptions);

    expect(octokitError.sentryScope.fingerprint).toEqual([
      '{{ default }}',
      'GET',
      '/users/:username',
      401,
    ]);
  });
});
