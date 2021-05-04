const getJiraConfiguration = require('../../lib/frontend/get-jira-configuration');

beforeAll(() => {
  // Create a spy on console (console.error in this case) and provide some mocked implementation
  // In mocking global objects it's usually better than simple `jest.fn()`
  // because you can `unmock` it in clean way doing `mockRestore`
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  // Restore mock after all tests are done, so it won't affect other test suites
  console.error.mockRestore();
});

afterEach(() => {
  // Clear mock (all calls etc) after each test.
  // It's needed when you're using console somewhere in the tests so you have clean mock each time
  console.error.mockClear();
});

const mockRequest = () => {
  const req = {};

  req.query = { xdm_e: 'https://somejirasite.atlassian.net' };
  req.csrfToken = jest.fn().mockReturnValue(req);
  req.log = jest.fn().mockReturnValue(req);

  return req;
};

const mockResponse = () => {
  const res = {};
  res.locals = {
    client: {
      apps: {
        getInstallation: {
          endpoint: {
            DEFAULTS: {},
            defaults: jest.fn().mockReturnValue(res),
            merge: jest.fn().mockReturnValue(res),
            parse: jest.fn().mockReturnValue(res),
          },
          defaults: jest.fn().mockReturnValue(res),
        },
      },
    },
  };

  res.render = jest.fn().mockReturnValue(res);
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);

  return res;
};

const mockRequestMissingToken = () => {
  const req = {};

  req.query = { xdm_e: 'https://somejirasite.atlassian.net' };
  req.csrfToken = 'badvalue';

  return req;
};

describe('Jira Configuration Suite', () => {
  it('should return success message after page is rendered', async () => {
    await expect(getJiraConfiguration(mockRequest(), mockResponse())).resolves;
  });

  it('should throw an error', async () => {
    await expect(getJiraConfiguration(mockRequest(), mockRequestMissingToken())).rejects.toThrow();
  });
});
