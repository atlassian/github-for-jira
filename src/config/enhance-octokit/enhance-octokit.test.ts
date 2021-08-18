import GitHubAPI from "../github-api";
import enhanceOctokit from ".";

describe("enhanceOctokit", () => {
	describe.skip("request metrics", () => {
		let octokit;

		beforeEach(async () => {
			octokit = GitHubAPI();
			enhanceOctokit(octokit);
		});

		describe("when successful", () => {
			beforeEach(() => {
				githubNock.get("/events").reply(200, []);
			});

			it("sends reqest timing", async () => {
				await expect(await octokit.activity.listPublicEvents()).toHaveBeenCalled();

				// TODO: reoslve Property 'toHaveSentMetrics' does not exist on type 'JestMatchers<any>'.
				// .toHaveSentMetrics({
				//   name: 'jira-integration.github-request',
				//   type: 'h',
				//   value: (value) => value > 0 && value < 1000, // Value changes depending on how long nock takes
				//   tags: {
				//     path: '/events',
				//     method: 'GET',
				//     status: '200',
				//     env: 'test',
				//   },
				// });
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
				githubNock.get("/events").reply(500, []);
			});

			it("sends request timing", async () => {
				await expect(
					await octokit.activity.listPublicEvents().catch(jest.fn())
				).toHaveBeenCalled();
				// TODO: reoslve Property 'toHaveSentMetrics' does not exist on type 'JestMatchers<any>'.
				// .toHaveSentMetrics({
				//   name: 'jira-integration.github-request',
				//   type: 'h',
				//   value: (value) => value > 0 && value < 1000, // Value changes depending on how long nock takes
				//   tags: {
				//     path: '/events',
				//     method: 'GET',
				//     status: '500',
				//     env: 'test',
				//   },
				// });
			});

			it("logs request timing", async () => {
				await octokit.activity.listPublicEvents().catch(jest.fn());

				// TODO: fix this test to not rely on logger output...
				/*const debugLog = log.debugValues[0];
				expect(log.debugValues).toHaveLength(1);
				expect(debugLog.metadata).toEqual({ path: '/events', method: 'GET', status: 500 });
				expect(debugLog.message).toMatch(/GitHub request time: \d+ms/);*/
			});
		});
	});
});
