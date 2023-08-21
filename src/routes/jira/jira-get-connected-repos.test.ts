import { Request, Response, NextFunction } from "express";
import { Subscription } from "~/src/models/subscription";
import { RepoSyncState } from "~/src/models/reposyncstate";
import { Op } from "sequelize";
import { JiraGetConnectedRepos } from "./jira-get-connected-repos";
jest.mock("~/src/models/subscription");
jest.mock("~/src/models/reposyncstate");

describe("JiraGetConnectedRepos", () => {
	let req: Request;
	let res: Response;
	let next: NextFunction;
	let repo;

	beforeEach(async () => {
		req = {
			params: { subscriptionId: "111222333" },
			log: { error: jest.fn() },
			query: {
				page: 1,
				pageSize: 3,
				repoName: "github-for-jira",
				syncStatus: "finished"
			}
		} as unknown as Request;
		res = {
			status: jest.fn(() => res),
			send: jest.fn(),
			render: jest.fn().mockReturnValue({}),
			locals: {
				jiraHost: null,
				nonce: null
			}
		} as unknown as Response;
		next = jest.fn();
		repo = {
			subscriptionId: "111222333",
			repoId: 1,
			repoName: "github-for-jira",
			repoOwner: "atlassian",
			repoFullName: "atlassian/github-for-jira",
			repoUrl: "github.com/atlassian/github-for-jira"
		};
	});
	afterEach(() => {
		jest.resetAllMocks();
	});
	it("should handle missing subscription ID", async () => {
		const request = {
			...req,
			params: {
				...req.params,
				subscriptionId: null
			}
		} as unknown as Request;
		await JiraGetConnectedRepos(request, res, next);
		expect(res.status).toHaveBeenCalledWith(401);
		expect(req.log.error).toHaveBeenCalledWith("Missing Subscription ID");
		expect(res.status).toHaveBeenCalledTimes(1);
		expect(res.send).toHaveBeenCalledWith("Missing Subscription ID");
		expect(Subscription.findByPk).not.toHaveBeenCalled();
		expect(next).not.toHaveBeenCalled();
	});
	it("should handle missing subscription", async () => {
		Subscription.findByPk = jest.fn().mockResolvedValueOnce(null);
		await JiraGetConnectedRepos(req, res, next);
		expect(req.log.error).toHaveBeenCalledTimes(1);
		expect(req.log.error).toHaveBeenCalledWith("Missing Subscription");
		expect(res.status).toHaveBeenCalledTimes(1);
		expect(res.status).toHaveBeenCalledWith(401);
		expect(res.send).toHaveBeenCalledTimes(1);
		expect(res.send).toHaveBeenCalledWith("Missing Subscription");
		expect(Subscription.findByPk).toHaveBeenCalledTimes(1);
		expect(Subscription.findByPk).toHaveBeenCalledWith(111222333);
		expect(next).not.toHaveBeenCalled();
	});
	it("should handle error", async () => {
		Subscription.findByPk = jest
			.fn()
			.mockRejectedValueOnce(new Error("something went wrong"));
		await JiraGetConnectedRepos(req, res, next);
		expect(res.status).not.toHaveBeenCalled();
		expect(res.send).not.toHaveBeenCalled();
		expect(next).toHaveBeenCalledTimes(1);
		expect(next).toHaveBeenCalledWith(
			new Error("Failed to render connected repos: Error: something went wrong")
		);
	});

	it("should call RepoSyncState.countSubscriptionRepos() with the correct arguments", async () => {
		const countSubscriptionRepos = jest
			.spyOn(RepoSyncState, "countSubscriptionRepos")
			.mockResolvedValueOnce(15);
		const subscription = { id: 1 };
		Subscription.findByPk = jest.fn().mockResolvedValueOnce(subscription);

		await JiraGetConnectedRepos(req, res, next);

		expect(countSubscriptionRepos).toHaveBeenCalledWith(subscription, {
			where: {
				[Op.and]: [
					{
						repoName: {
							[Op.iLike]: "%github-for-jira%"
						}
					},
					{
						[Op.or]: [
							{
								branchStatus: "finished"
							},
							{
								commitStatus: "finished"
							},
							{
								pullStatus: "finished"
							},
							{
								buildStatus: "finished"
							},
							{
								deploymentStatus: "finished"
							}
						]
					}
				]
			}
		});
	});

	it("should call RepoSyncState.findAllFromSubscription() with the correct arguments", async () => {
		const reposyncState = [
			{
				...repo,
				pullStatus: "pending",
				commitStatus: "complete",
				branchStatus: "pending",
				buildStatus: "complete",
				deploymentStatus: "complete"
			},
			{
				...repo,
				pullStatus: "complete",
				commitStatus: "failed",
				branchStatus: "complete",
				buildStatus: "failed",
				deploymentStatus: "complete"
			},
			{
				...repo,
				pullStatus: "complete",
				commitStatus: "complete",
				branchStatus: "complete",
				buildStatus: "complete",
				deploymentStatus: "complete"
			}
		];
		const findAllFromSubscription = jest
			.spyOn(RepoSyncState, "findAllFromSubscription")
			.mockResolvedValueOnce(Promise.resolve(reposyncState));
		const subscription = { id: 1 };
		Subscription.findByPk = jest.fn().mockResolvedValueOnce(subscription);

		await JiraGetConnectedRepos(req, res, next);

		expect(findAllFromSubscription).toHaveBeenCalledWith(subscription, {
			limit: 3,
			offset: 0,
			where: {
				[Op.and]: [
					{
						repoName: {
							[Op.iLike]: "%github-for-jira%"
						}
					},
					{
						[Op.or]: [
							{
								branchStatus: "finished"
							},
							{
								commitStatus: "finished"
							},
							{
								pullStatus: "finished"
							},
							{
								buildStatus: "finished"
							},
							{
								deploymentStatus: "finished"
							}
						]
					}
				]
			}
		});
	});
});
