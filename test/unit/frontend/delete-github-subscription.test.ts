/* eslint-disable @typescript-eslint/no-explicit-any */
import testTracking from "../../setup/tracking";
import nock from "nock";
import { Installation, Subscription } from "../../../src/models";
import { mocked } from "ts-jest/utils";
import deleteSubscription from "../../../src/frontend/delete-github-subscription";

jest.mock("../../../src/models");

describe("POST /github/subscription", () => {
	let installation;
	let subscription;
	let deleteGitHubSubscription;

	beforeEach(async () => {
		subscription = {
			githubInstallationId: 15,
			jiraHost: "https://test-host.jira.com",
			destroy: jest.fn().mockResolvedValue(undefined)
		};

		installation = {
			id: 19,
			jiraHost: subscription.jiraHost,
			clientKey: "abc123",
			enabled: true,
			secrets: "def234",
			sharedSecret: "ghi345",
			subscriptions: jest.fn().mockResolvedValue([])
		};

		mocked(Subscription.getSingleInstallation).mockResolvedValue(subscription);
		mocked(Subscription.install).mockResolvedValue(subscription);
		mocked(Installation.getForHost).mockResolvedValue(installation);

		deleteGitHubSubscription = await deleteSubscription;
	});

	it("Delete Jira Configuration", async () => {
		await testTracking();

		nock(subscription.jiraHost)
			.delete("/rest/devinfo/0.10/bulkByProperties")
			.query({ installationId: subscription.githubInstallationId })
			.reply(200, "OK");

		const req = {
			log: { error: jest.fn(), info: jest.fn() },
			body: {
				installationId: subscription.githubInstallationId,
				jiraHost: subscription.jiraHost
			},
			query: {
				xdm_e: subscription.jiraHost
			},
			session: {
				githubToken: "abc-token"
			}
		};

		const login = "test-user";
		const listInstallations = jest.fn().mockResolvedValue({
			data: {
				installations: [
					{
						id: subscription.githubInstallationId,
						target_type: "User",
						account: { login }
					}
				]
			}
		});

		const getAuthenticated = jest.fn().mockResolvedValue({ data: { login } });
		const res = {
			sendStatus: jest.fn(),
			status: jest.fn(),
			locals: {
				github: {
					apps: { listInstallationsForAuthenticatedUser: listInstallations },
					users: { getAuthenticated }
				}
			}
		};

		await deleteGitHubSubscription(req as any, res as any);
		expect(subscription.destroy).toHaveBeenCalled();
		expect(res.sendStatus).toHaveBeenCalledWith(202);
	});

	it("Missing githubToken", async () => {
		const req = {
			session: {}
		};

		const res = {
			sendStatus: jest.fn()
		};

		await deleteGitHubSubscription(req as any, res as any);
		expect(res.sendStatus).toHaveBeenCalledWith(401);
	});

	test.each([["installationId"], ["jiraHost"]])(
		"missing body.%s",
		async (property) => {
			const req = {
				session: { githubToken: "example-token" },
				body: {
					installationId: "an installation id",
					jiraHost: "https://jira-host"
				}
			};
			delete req.body[property];

			const res = {
				status: jest.fn(),
				json: jest.fn()
			};

			res.status.mockReturnValue(res);

			await deleteGitHubSubscription(req as any, res as any);
			expect(res.status).toHaveBeenCalledWith(400);
			expect(res.json.mock.calls[0]).toMatchSnapshot([
				{
					err: expect.any(String)
				}
			]);
		}
	);
});
