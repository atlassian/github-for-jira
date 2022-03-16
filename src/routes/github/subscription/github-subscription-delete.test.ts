/* eslint-disable @typescript-eslint/no-explicit-any */
import { Installation, Subscription } from "models/index";
import { GithubSubscriptionDelete } from "./github-subscription-delete";

describe("POST /github/subscription", () => {
	const gitHubInstallationId = 15;

	beforeEach(async () => {
		await Subscription.create({
			gitHubInstallationId,
			jiraHost
		});

		await Installation.create({
			jiraHost,
			clientKey: "client-key",
			sharedSecret: "shared-secret"
		});
	});

	it("Delete Jira Configuration", async () => {
		const req = {
			log: { error: jest.fn(), info: jest.fn() },
			body: {
				installationId: gitHubInstallationId,
				jiraHost
			}
		};

		const login = "test-user";

		const getAuthenticated = jest.fn().mockResolvedValue({ data: { login } });
		const res = {
			sendStatus: jest.fn(),
			status: jest.fn(),
			locals: {
				jiraHost,
				githubToken: "abc-token",
				github: {
					apps: {
						listInstallationsForAuthenticatedUser: jest.fn().mockResolvedValue({
							data: {
								installations: [
									{
										id: gitHubInstallationId,
										target_type: "User",
										account: { login }
									}
								]
							}
						})
					},
					users: { getAuthenticated }
				}
			}
		};

		await GithubSubscriptionDelete(req as any, res as any);
		expect(res.sendStatus).toHaveBeenCalledWith(202);
		expect(await Subscription.count()).toEqual(0);
	});

	it("Missing githubToken", async () => {
		const req = {
			session: {}
		};

		const res = {
			sendStatus: jest.fn(),
			locals: {}
		};

		await GithubSubscriptionDelete(req as any, res as any);
		expect(res.sendStatus).toHaveBeenCalledWith(401);
	});

	test.each([["installationId"], ["jiraHost"]])(
		"missing body.%s",
		async (property) => {
			const req = {
				body: {
					installationId: "an installation id",
					jiraHost
				}
			};
			const res = {
				status: jest.fn(),
				json: jest.fn(),
				locals: {
					jiraHost,
					githubToken: "example-token"
				}
			};

			delete req.body[property];
			delete res.locals[property];

			res.status.mockReturnValue(res);

			await GithubSubscriptionDelete(req as any, res as any);
			expect(res.status).toHaveBeenCalledWith(400);
			expect(res.json.mock.calls[0]).toMatchSnapshot([
				{
					err: expect.any(String)
				}
			]);
		}
	);
});
