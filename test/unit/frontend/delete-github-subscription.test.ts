/* eslint-disable @typescript-eslint/no-explicit-any */
import { Installation, Subscription } from "../../../src/models";
import deleteSubscription from "../../../src/frontend/delete-github-subscription";

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

	afterEach(async () => {
		await Installation.destroy({ truncate: true });
		await Subscription.destroy({ truncate: true });
	});

	it("Delete Jira Configuration", async () => {
		const req = {
			log: { error: jest.fn(), info: jest.fn() },
			body: {
				installationId: gitHubInstallationId,
				jiraHost
			},
			query: {
				xdm_e: jiraHost
			},
			session: {
				githubToken: "abc-token"
			}
		};

		const login = "test-user";

		const getAuthenticated = jest.fn().mockResolvedValue({ data: { login } });
		const res = {
			sendStatus: jest.fn(),
			status: jest.fn(),
			locals: {
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

		await deleteSubscription(req as any, res as any);
		expect(res.sendStatus).toHaveBeenCalledWith(202);
		expect(await Subscription.count()).toEqual(0);
	});

	it("Missing githubToken", async () => {
		const req = {
			session: {}
		};

		const res = {
			sendStatus: jest.fn()
		};

		await deleteSubscription(req as any, res as any);
		expect(res.sendStatus).toHaveBeenCalledWith(401);
	});

	test.each([["installationId"], ["jiraHost"]])(
		"missing body.%s",
		async (property) => {
			const req = {
				session: { githubToken: "example-token" },
				body: {
					installationId: "an installation id",
					jiraHost
				}
			};
			delete req.body[property];

			const res = {
				status: jest.fn(),
				json: jest.fn()
			};

			res.status.mockReturnValue(res);

			await deleteSubscription(req as any, res as any);
			expect(res.status).toHaveBeenCalledWith(400);
			expect(res.json.mock.calls[0]).toMatchSnapshot([
				{
					err: expect.any(String)
				}
			]);
		}
	);
});
