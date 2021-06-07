import getJiraAxios from "../../../../src/jira/client/axios";

describe("Jira axios instance", () => {

  describe("request metrics", () => {

    describe("when request successful", () => {
      it("sends timing metric", async () => {
        jiraNock.get("/foo/bar").reply(200);

        await expect(getJiraAxios(jiraHost, "secret").get("/foo/bar")).toResolve();
        expect(jiraNock).toBeDone();
        // TODO- fix me
        /*expect(undefined).toHaveSentMetrics({
          name: "jira-integration.jira_request",
          type: "h",
          tags: {
            path: "/foo/bar",
            method: "GET",
            status: "200",
            env: "test"
          }
        });*/
      });

      it("removes URL query params from path", async () => {
        jiraNock.get("/foo/bar?baz=true").reply(200);

        await expect(getJiraAxios(jiraHost, "secret").get("/foo/bar?baz=true")).toResolve();
        expect(jiraNock).toBeDone()
        // TODO- fix me
        // .toHaveSentMetrics({
        //   name: 'jira-integration.jira_request',
        //   type: 'h',
        //   tags: { path: '/foo/bar' },
        // });
      });
    });

    describe("when request fails", () => {
      it("sends timing metric", async () => {
        jiraNock.get("/foo/bar").reply(500);

        await expect(getJiraAxios(jiraHost, "secret").get("/foo/bar")).toReject();
        expect(jiraNock).toBeDone();
        // TODO- fix me
        // .toHaveSentMetrics({
        //   name: 'jira-integration.jira_request',
        //   type: 'h',
        //   tags: {
        //     path: '/foo/bar',
        //     method: 'GET',
        //     status: '500',
        //     env: 'test',
        //   },
        //   value: (value) => value > 0 && value < 1000,
        // });
      });
    });
  });
});
