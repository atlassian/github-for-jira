import supertest from "supertest";
import { sequelize } from "models/sequelize";
import { Application } from "express";
import { Subscription } from "models/subscription";
import { RepoSyncState } from "models/reposyncstate";
import { getFrontendApp } from "~/src/app";

describe("Copy data table", () => {

	let app: Application;
	let dest: string;

	beforeEach(async () => {
		app = getFrontendApp();
		dest = "RepoSyncStates" + ("" + Math.floor(Math.random() * 10000)).substr(0, 5);
	});

	it("should copy RepoSyncState", async () => {
		//preparing data
		const sub = await Subscription.install({
			clientKey: "some-key",
			host: jiraHost,
			gitHubAppId: undefined,
			installationId: 123
		});
		await createdRepoSyncState("first", sub.id);
		await createdRepoSyncState("second", sub.id);
		await createdRepoSyncState("third", sub.id);
		expect([...await RepoSyncState.findAll()].length).toBe(3);

		//call clean up api
		await supertest(app)
			.post(`/api/data-cleanup/copy-data-table?src=RepoSyncStates&dest=${dest}`)
			.set("X-Slauth-Mechanism", "test")
			.expect(200);

		//check result is correct
		const copiedData = await RepoSyncState.sequelize?.query(`select * from "${dest}"`, { mapToModel: true });
		expect(copiedData[0]).toEqual(expect.arrayContaining([
			expect.objectContaining({ subscriptionId: sub.id, repoFullName: "first repo full name" }),
			expect.objectContaining({ subscriptionId: sub.id, repoFullName: "second repo full name" }),
			expect.objectContaining({ subscriptionId: sub.id, repoFullName: "third repo full name" })
		]));
	});

	afterEach(async ()=> {
		await sequelize.query(`drop table if exists "${dest}"`);
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
