import { getAxiosInstance } from "./axios";
import { getLogger } from "config/logger";
import { statsd } from "config/statsd";

describe("Jira axios instance", () => {

	describe("request metrics", () => {

		describe("when request successful", () => {

			let histogramSpy;
			beforeEach(() => {
				histogramSpy = jest.spyOn(statsd, "histogram");
			});

			it("sends timing metric", async () => {
				jiraNock.get("/foo/bar").reply(200);

				await expect(getAxiosInstance(jiraHost, "secret", getLogger("test")).get("/foo/bar")).toResolve();
				expect(jiraNock).toBeDone();
				expect(histogramSpy).toHaveBeenCalledWith(
					"app.server.http.request.jira",
					expect.anything(), //execution time, ignore expect
					{
						gsd_histogram: "100_1000_2000_3000_5000_10000_30000_60000",
						path: "/foo/bar",
						method: "GET",
						status: 200
					},
					{ jiraHost }
				);
			});

			it("removes URL query params from path", async () => {
				jiraNock.get("/foo/bar?baz=true").reply(200);

				await expect(getAxiosInstance(jiraHost, "secret", getLogger("test")).get("/foo/bar?baz=true")).toResolve();
				expect(jiraNock).toBeDone();
				expect(histogramSpy).toHaveBeenCalledWith(
					"app.server.http.request.jira",
					expect.anything(), //execution time, ignore expect
					{
						gsd_histogram: "100_1000_2000_3000_5000_10000_30000_60000",
						path: "/foo/bar",
						method: "GET",
						status: 200
					},
					{ jiraHost }
				);
			});
		});

		describe("when request fails", () => {
			it("sends timing metric", async () => {
				jiraNock.get("/foo/bar").reply(500);

				await expect(getAxiosInstance(jiraHost, "secret", getLogger("test")).get("/foo/bar")).toReject();
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

	it("should return original 503 error from failed request if Jira is active", async () => {
		const requestPayload = "TestRequestPayload";
		jiraNock.post("/foo/bar", requestPayload).reply(503);
		jiraNock.get("/status").reply(200);

		let error;
		try {
			await getAxiosInstance(jiraHost, "secret", getLogger("test")).post("/foo/bar", requestPayload);
		} catch (e: unknown) {
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
			await getAxiosInstance(jiraHost, "secret", getLogger("test")).post("/foo/bar", requestPayload);
		} catch (e: unknown) {
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
			await getAxiosInstance(jiraHost, "secret", getLogger("test")).post("/foo/bar", requestPayload);
		} catch (e: unknown) {
			error = e;
		}

		expect(error?.status).toEqual(404);
		expect(error?.message).toEqual("Error executing Axios Request HTTP 404 - Bad REST path, or Jira instance not found, renamed or temporarily suspended.");
	});

	describe("when having a rate limited", () => {
		it("should extract the retry after header if present", async () => {
			const requestPayload = "TestRequestPayload";
			jiraNock.post("/foo/bar", requestPayload)
				.reply(429, "", {
					"Retry-After": "100"
				});

			await expect(getAxiosInstance(jiraHost, "secret", getLogger("test")).post("/foo/bar", requestPayload))
				.rejects.toMatchObject({
					status: 429,
					retryAfterInSeconds: 100
				});

		});
	});

});
