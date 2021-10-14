import express, { Application } from "express";
import info from "../../src/frontend/info";
import supertest from "supertest";

describe("/info", () => {
	let app: Application;
	beforeEach(async () => {
		app = express();
		app.use("/info", info);
	});

	it("should return 200 and info", async () => {
		process.env.COMMIT_SHA = "34b6df6ca06f4ba9516a6e943b90bdb148b3f0e8";
		process.env.COMMIT_DATE = "Wed Oct 13 16:32:22 2021 +1100";

		return supertest(app)
			.get("/info")
			.expect(200)
			.then((response) => {
				expect(response.body).toEqual({
					commit: "https://github.com/atlassian/github-for-jira/commit/34b6df6ca06f4ba9516a6e943b90bdb148b3f0e8",
					date: "Wed Oct 13 16:32:22 2021 +1100",
				});
			});
	});
});
