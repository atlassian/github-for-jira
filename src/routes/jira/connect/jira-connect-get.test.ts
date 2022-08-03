import { JiraConnectGet } from "routes/jira/connect/jira-connect-get";

describe("GET /jira/connect", () => {
	const mockRequest = (): any => ({
		log: {
			info: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
			debug: jest.fn()
		}
	});

	const mockResponse = (): any => ({
		locals: {
			jiraHost
		},
		render: jest.fn().mockReturnValue({}),
		status: jest.fn().mockReturnValue({}),
		send: jest.fn().mockReturnValue({})
	});

	it("Get Jira Configuration", async () => {
		const response = mockResponse();
		await JiraConnectGet(mockRequest(), response, jest.fn());
		expect(response.render.mock.calls[0][0]).toBe("jira-select-github-product.hbs");
	});
});