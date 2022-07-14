import { getAxiosInstance, JiraClientError } from "./axios";

describe("Jira axios instance", () => {

	describe("request metrics", () => {

		describe("when request successful", () => {
			it("sends timing metric", async () => {
				jiraNock.get("/foo/bar").reply(200);

				await expect(getAxiosInstance(jiraHost, "secret").get("/foo/bar")).toResolve();
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

				await expect(getAxiosInstance(jiraHost, "secret").get("/foo/bar?baz=true")).toResolve();
				expect(jiraNock).toBeDone();
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

				await expect(getAxiosInstance(jiraHost, "secret").get("/foo/bar")).toReject();
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

			it("Serialized error doesn't have request payload", async () => {
				const requestPayload = "TestRequestPayload";
				jiraNock.post("/foo/bar", requestPayload).reply(500);

				let error = undefined;
				try {
					await getAxiosInstance(jiraHost, "secret").post("/foo/bar", requestPayload);
				} catch (e) {
					error = e;
				}

				expect(error).toBeInstanceOf(JiraClientError);
				const serialisedError = JSON.stringify(error);
				expect(serialisedError).not.toContain(requestPayload);
			});

		});
	});

	it("should return original 503 error from failed request if Jira is active", async () => {
		const requestPayload = "TestRequestPayload";
		jiraNock.post("/foo/bar", requestPayload).reply(503);
		jiraNock.get("/status").reply(200);

		let error;
		try {
			await getAxiosInstance(jiraHost, "secret").post("/foo/bar", requestPayload);
		} catch (e) {
			error = e;
		}

		expect(error?.status).toEqual(503);
	});

	it("should return 404 from failed request if Jira is deactivated", async () => {
		const requestPayload = "TestRequestPayload";
		jiraNock.post("/foo/bar", requestPayload).reply(503);
		jiraNock.get("/status").reply(503);

		let error;
		try {
			await getAxiosInstance(jiraHost, "secret").post("/foo/bar", requestPayload);
		} catch (e) {
			error = e;
		}

		expect(error?.status).toEqual(404);
		expect(error?.message).toEqual("Error executing Axios Request HTTP 404 - Bad REST path, or Jira instance not found, renamed or temporarily suspended.");
	});

	it("should return 404 from failed request if Jira has been renamed", async () => {
		const requestPayload = "TestRequestPayload";
		jiraNock.post("/foo/bar", requestPayload).reply(405);
		jiraNock.get("/status").reply(302);

		let error;
		try {
			await getAxiosInstance(jiraHost, "secret").post("/foo/bar", requestPayload);
		} catch (e) {
			error = e;
		}

		expect(error?.status).toEqual(404);
		expect(error?.message).toEqual("Error executing Axios Request HTTP 404 - Bad REST path, or Jira instance not found, renamed or temporarily suspended.");
	});

});
