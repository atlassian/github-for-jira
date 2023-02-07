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

	it("should NOT delete orphan RepoSyncState in dry run mode", async () => {
		//preparing data
		const sub = await Subscription.install({
			hashedClientKey: "some-key",
			host: jiraHost,
			gitHubAppId: undefined,
			installationId: 123
		});
		await createdRepoSyncState("first", sub.id);
		expect([...await RepoSyncState.findAll()].length).toBe(1);

		//call clean up api
		await supertest(app).delete(`/api/data-cleanup/repo-sync-states?repoSyncStateId=9999`).set("X-Slauth-Mechanism", "test").expect(200);
		await supertest(app).delete(`/api/data-cleanup/repo-sync-states?repoSyncStateId=9999&commitToDB=`).set("X-Slauth-Mechanism", "test").expect(200);
		await supertest(app).delete(`/api/data-cleanup/repo-sync-states?repoSyncStateId=9999&commitToDB=false`).set("X-Slauth-Mechanism", "test").expect(200);
		await supertest(app).delete(`/api/data-cleanup/repo-sync-states?repoSyncStateId=9999&commitToDB=whatever`).set("X-Slauth-Mechanism", "test").expect(200);

		//check result is correct
		expect([...await RepoSyncState.findAll()].length).toBe(1);
	});

	const createdRepoSyncState = async (prefix: string, subscriptionId: number) => {
		return await RepoSyncState.create({
			subscriptionId: subscriptionId,
			repoId: 1,
			repoName: `${prefix} repo name`,
			repoOwner: "owner name",
			repoFullName: `${prefix} repo full name`,
			repoUrl: jiraHost,
			repoPushedAt: new Date(),
			repoUpdatedAt: new Date(),
			repoCreatedAt: new Date()
		});
	};
});
