import express, { Application } from "express";
import version from "../../src/frontend/version";
import supertest from "supertest";
import envVars from "../../src/config/env";

describe("/version", () => {
	let app: Application;
	beforeEach(async () => {
		app = express();
		app.use("/version", version);
	});

	it("should return 200 with relevant git branch and commit details", async () => {
		envVars.GIT_COMMIT_SHA = "34b6df6ca06f4ba9516a6e943b90bdb148b3f0e8";
		envVars.GIT_COMMIT_DATE = "Wed Oct 13 16:32:22 2021 +1100";
		envVars.GIT_BRANCH_NAME = "arc-384-info";
		envVars.DEPLOYMENT_DATE = "Wed Oct 13 16:32:22 2021 AEDT";

		return supertest(app)
			.get("/version")
			.expect(200)
			.then((response) => {
				expect(response.body).toEqual({
					branch: "arc-384-info",
					branchUrl: "https://github.com/atlassian/github-for-jira/tree/arc-384-info",
					commit: "34b6df6ca06f4ba9516a6e943b90bdb148b3f0e8",
					commitDate: "Wed Oct 13 16:32:22 2021 +1100",
					commitUrl: "https://github.com/atlassian/github-for-jira/commit/34b6df6ca06f4ba9516a6e943b90bdb148b3f0e8",
					deploymentDate: "Wed Oct 13 16:32:22 2021 AEDT"
				});
			});
	});
});
