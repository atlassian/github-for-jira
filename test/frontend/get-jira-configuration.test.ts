/* eslint-disable @typescript-eslint/no-explicit-any */
import getJiraConfiguration from "../../src/frontend/get-jira-configuration";

describe("Jira Configuration Suite", () => {
  let consoleSpy: jest.SpyInstance;

  beforeAll(() => {
    // Create a spy on console (console.error in this case) and provide some mocked implementation
    // In mocking global objects it's usually better than simple `jest.fn()`
    // because you can `unmock` it in clean way doing `mockRestore`
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {
    });
  });

// Restore mock after all tests are done, so it won't affect other test suites
  afterAll(() => consoleSpy.mockRestore());

// Clear mock (all calls etc) after each test.
// It's needed when you're using console somewhere in the tests so you have clean mock each time
  afterEach(() => consoleSpy.mockClear());

  const mockRequest = (): any => ({
    query: { xdm_e: "https://somejirasite.atlassian.net" },
    csrfToken: jest.fn().mockReturnValue({}),
    log: jest.fn().mockReturnValue({})
  });

  const mockResponse = (): any => ({
    locals: {
      client: {
        apps: {
          getInstallation: {
            endpoint: {
              DEFAULTS: {},
              defaults: jest.fn().mockReturnValue({}),
              merge: jest.fn().mockReturnValue({}),
              parse: jest.fn().mockReturnValue({})
            },
            defaults: jest.fn().mockReturnValue({})
          }
        }
      }
    },
    render: jest.fn().mockReturnValue({}),
    status: jest.fn().mockReturnValue({}),
    send: jest.fn().mockReturnValue({})
  });

  const mockRequestMissingToken = (): any => ({
    query: { xdm_e: "https://somejirasite.atlassian.net" },
    csrfToken: "badvalue"
  });


  it("should return success message after page is rendered", () =>
    expect(getJiraConfiguration(mockRequest(), mockResponse(), () => undefined)).resolves.toBeCalled()
  );

  it("should throw an error", () =>
    expect(getJiraConfiguration(mockRequest(), mockRequestMissingToken(), () => undefined)).rejects.toThrow()
  );
});
