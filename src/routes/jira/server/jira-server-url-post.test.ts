import { JiraServerUrlPost } from "routes/jira/server/jira-server-url-post";

describe("Jira Server Url Suite", () => {
	it("should return error message when invalid url is sent in request", async () => {
		const mockRequest = (): any => ({
			body: {
				installationId: 2,
				gheServerURL: "thisisntaurl"
			}
		});

		const mockResponse = (): any => ({
			locals: {
				jiraHost
			},
			render: jest.fn().mockReturnValue({}),
			status: () => ({
				send: jest.fn().mockReturnValue({ success: false, error: "Invalid URL", message: "The entered URL is not valid."})
			}),
			send: jest.fn().mockReturnValue({})
		});

		await JiraServerUrlPost(mockRequest(), mockResponse());
		expect(mockResponse().status().send()).toEqual({ success: false, error: "Invalid URL", message: "The entered URL is not valid." });
	});
});
