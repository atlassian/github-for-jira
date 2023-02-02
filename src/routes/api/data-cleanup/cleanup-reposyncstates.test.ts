import supertest from "supertest";
import { Application } from "express";
import { Subscription } from "models/subscription";
import { RepoSyncState } from "models/reposyncstate";
import { getFrontendApp } from "~/src/app";

describe("Cleanup RepoSyncState", () => {

	let app: Application;

	beforeEach(async () => {
		app = getFrontendApp();
	});

	it("should delete orphan RepoSyncState, while leave rest untouch", async () => {

		//preparing data
		const sub = await Subscription.install({
			clientKey: "some-key",
			host: jiraHost,
			gitHubAppId: undefined,
			installationId: 123
		});
		await RepoSyncState.create({
			subscriptionId: sub.id, //a up to date repo that link to sub
			repoId: 1,
			repoName: "a repo name",
			repoOwner: "owner name",
			repoFullName: "repo full name",
			repoUrl: jiraHost,
			repoPushedAt: new Date(),
			repoUpdatedAt: new Date(),
			repoCreatedAt: new Date()
		});
		await RepoSyncState.create({
			subscriptionId: 99999, //something non-exists, so this is an orphan
			repoId: 1,
			repoName: "another repo name",
			repoOwner: "owner name",
			repoFullName: "another repo full name",
			repoUrl: jiraHost,
			repoPushedAt: new Date(),
			repoUpdatedAt: new Date(),
			repoCreatedAt: new Date()
		});

		//call clean up api
		await supertest(app)
			.delete("/api/data-cleanup/repo-sync-states")
			.expect(200);

		//check result is correct
		expect(await RepoSyncState.findAll().length).toBe(1);
		const upToDateRepoSyncState = await RepoSyncState.findOne({ where: { "subscriptionId": sub.id } });
		expect(upToDateRepoSyncState.repoFullName).toBe("repo full name");
	});
});
