import { logger } from "probot/lib/logger";

describe("Probot event middleware", () => {
  let GitHubAPI;
  let middleware;

  beforeEach(async () => {
    GitHubAPI = (await import("../../../src/config/github-api")).default;
    middleware = (await import("../../../src/github/middleware")).default;
  });

  describe("when processing fails for one subscription", () => {
    let context;
    let handlerCalls;

    beforeEach(async () => {
      context = {
        payload: {
          sender: { type: "not bot" },
          installation: { id: 1234 }
        },
        github: GitHubAPI(),
        log: logger
      };

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      models.Installation.getForHost = jest.fn(async (jiraHost) => {
        const installations = [
          { jiraHost: "https://foo.atlassian.net", sharedSecret: "secret1" },
          { jiraHost: "https://bar.atlassian.net", sharedSecret: "secret2" },
          { jiraHost: "https://baz.atlassian.net", sharedSecret: "secret3" }
        ];

        return installations.find(installation => installation.jiraHost === jiraHost);
      });

      models.Subscription.getAllForInstallation = jest.fn().mockResolvedValue([
        { jiraHost: "https://foo.atlassian.net" },
        { jiraHost: "https://bar.atlassian.net" },
        { jiraHost: "https://baz.atlassian.net" }
      ]);

      handlerCalls = [];
      const handler = middleware((context, jiraClient, util) => {
        handlerCalls.push([context, jiraClient, util]);

        if (handlerCalls.length === 1) {
          throw Error("boom");
        }
      });

      await handler(context);
    });

    it("calls handler for each subscription", async () => {
      expect(handlerCalls.length).toEqual(3);
    });
  });
});
