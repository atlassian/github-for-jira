describe("enhanceOctokit", () => {
  describe("request metrics", () => {
    let octokit;

    beforeEach(async () => {
      const GitHubAPI = (await import("../../../src/config/github-api")).default;
      const enhanceOctokit = (await import("../../../src/config/enhance-octokit")).default;
      octokit = GitHubAPI();
      enhanceOctokit(octokit);
    });

    describe("when successful", () => {
      beforeEach(() => {
        nock("https://api.github.com").get("/events").reply(200, []);
      });

      it("sends reqest timing", async () => {
        expect(await octokit.activity.listPublicEvents()).toHaveSentMetrics({
          name: "jira-integration.github-request",
          type: "h",
          value: (value) => value > 0 && value < 1000, // Value changes depending on how long nock takes
          tags: {
            path: "/events",
            method: "GET",
            status: "200",
            env: "test"
          }
        });
      });

      it("logs request timing", async () => {
        await octokit.activity.listPublicEvents();

        // TODO: fix this test to not rely on logger output...
        /*const debugLog = log.debugValues[0];
        expect(log.debugValues).toHaveLength(1);
        expect(debugLog.metadata).toEqual({ path: '/events', method: 'GET', status: 200 });
        expect(debugLog.message).toMatch(/GitHub request time: \d+ms/);*/
      });
    });

    describe("when fails", () => {
      beforeEach(() => {
        nock("https://api.github.com").get("/events").reply(500, []);
      });

      it("sends request timing", async () => {
        expect(await octokit.activity.listPublicEvents().catch(() => undefined))
          .toHaveSentMetrics({
            name: "jira-integration.github-request",
            type: "h",
            value: (value) => value > 0 && value < 1000, // Value changes depending on how long nock takes
            tags: {
              path: "/events",
              method: "GET",
              status: "500",
              env: "test"
            }
          });
      });

      it("logs request timing", async () => {
        await octokit.activity.listPublicEvents().catch(() => undefined);

        // TODO: fix this test to not rely on logger output...
        /*const debugLog = log.debugValues[0];
        expect(log.debugValues).toHaveLength(1);
        expect(debugLog.metadata).toEqual({ path: '/events', method: 'GET', status: 500 });
        expect(debugLog.message).toMatch(/GitHub request time: \d+ms/);*/
      });
    });
  });
});
