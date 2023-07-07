import { getFrontendApp } from "~/src/app";
import supertest from "supertest";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { encodeSymmetric } from "atlassian-jwt";
import { getLogger } from "config/logger";
import { Installation } from "models/installation";
import { Subscription } from "models/subscription";
import { generateSignedSessionCookieHeader } from "test/utils/cookies";
import { verifyAdminPermsAndFinishInstallation } from "services/subscription-installation-service";

import { GitHubServerApp } from "models/github-server-app";
import { when } from "jest-when";

jest.mock("services/subscription-installation-service");

describe("github-configuration-post", () => {
	let app;
	let installation: Installation;
	let subscription: Subscription;

	beforeEach(async () => {
		app = getFrontendApp();
		const result = await new DatabaseStateCreator().create();
		installation = result.installation;
		subscription = result.subscription;
	});

	const generateJwt = async () => {
		return encodeSymmetric({
			qsh: "context-qsh",
			iss: installation.plainClientKey
		}, await installation.decrypt("encryptedSharedSecret", getLogger("test")));
	};

	describe("cloud", () => {
		it("responds with 401 if not authorized with JWT", async () => {
			const result = await supertest(app)
				.post("/github/configuration")
				.query({
					jiraHost: installation.jiraHost
				})
				.set("Cookie", [`jiraHost=${installation.jiraHost}`]);
			expect(result.status).toStrictEqual(401);
		});

		it("responds with 401 if no valid gitHubToken in session", async () => {
			githubNock
				.get("/")
				.matchHeader("Authorization", "Bearer myToken")
				.reply(500);

			const result = await supertest(app)
				.post("/github/configuration")
				.query({
					jwt: await generateJwt()
				})
				.set("Cookie", generateSignedSessionCookieHeader({
					githubToken: "myToken"
				}))
				.send({ });
			expect(result.status).toStrictEqual(401);
		});

		it("responds with 400 of no installationId in body", async () => {
			githubNock
				.get("/")
				.matchHeader("Authorization", "Bearer myToken")
				.reply(200);

			const result = await supertest(app)
				.post("/github/configuration")
				.query({
					jwt: await generateJwt()
				})
				.set("Cookie", generateSignedSessionCookieHeader({
					githubToken: "myToken"
				}))
				.send({ });
			expect(result.status).toStrictEqual(400);
		});

		it("returns 401 when user is not an admin", async () => {
			githubNock
				.get("/")
				.matchHeader("Authorization", "Bearer myToken")
				.reply(200);

			when(verifyAdminPermsAndFinishInstallation).calledWith(
				"myToken", installation, undefined, subscription.gitHubInstallationId + 1, expect.anything()
			).mockResolvedValue({ error: "not admin" });

			const result = await supertest(app)
				.post("/github/configuration")
				.query({
					jwt: await generateJwt()
				})
				.set("Cookie", generateSignedSessionCookieHeader({
					githubToken: "myToken"
				}))
				.send({
					installationId: subscription.gitHubInstallationId + 1
				});
			expect(result.status).toStrictEqual(401);
		});

		it("creates subscription when the user is an admin", async () => {
			githubNock
				.get("/")
				.matchHeader("Authorization", "Bearer myToken")
				.reply(200);

			when(verifyAdminPermsAndFinishInstallation).calledWith(
				"myToken", installation, undefined, subscription.gitHubInstallationId + 1, expect.anything()
			).mockResolvedValue({ });

			const result = await supertest(app)
				.post("/github/configuration")
				.query({
					jwt: await generateJwt()
				})
				.set("Cookie", generateSignedSessionCookieHeader({
					githubToken: "myToken"
				}))
				.send({
					installationId: subscription.gitHubInstallationId + 1
				});
			expect(result.status).toStrictEqual(200);
		});
	});

	describe("server", () => {
		let gitHubServerApp: GitHubServerApp;

		beforeEach(async () => {
			gitHubServerApp = await DatabaseStateCreator.createServerApp(installation.id);
		});

		it("responds with 401 if not authorized with JWT", async () => {
			const result = await supertest(app)
				.post(`/github/${gitHubServerApp.uuid}/configuration`)
				.query({
					jiraHost: installation.jiraHost
				})
				.set("Cookie", [`jiraHost=${installation.jiraHost}`]);
			expect(result.status).toStrictEqual(401);
		});

		it("responds with 401 if no valid gitHubToken in session", async () => {
			gheNock
				.get("/api/v3")
				.matchHeader("Authorization", "Bearer myToken")
				.reply(500);

			const result = await supertest(app)
				.post(`/github/${gitHubServerApp.uuid}/configuration`)
				.query({
					jwt: await generateJwt()
				})
				.set("Cookie", generateSignedSessionCookieHeader({
					githubToken: "myToken",
					gitHubUuid: gitHubServerApp.uuid
				}))
				.send({ });
			expect(result.status).toStrictEqual(401);
		});

		it("responds with 400 of no installationId in body", async () => {
			gheNock
				.get("/api/v3")
				.matchHeader("Authorization", "Bearer myToken")
				.reply(200);

			const result = await supertest(app)
				.post(`/github/${gitHubServerApp.uuid}/configuration`)
				.query({
					jwt: await generateJwt()
				})
				.set("Cookie", generateSignedSessionCookieHeader({
					githubToken: "myToken",
					gitHubUuid: gitHubServerApp.uuid
				}))
				.send({ });
			expect(result.status).toStrictEqual(400);
		});

		it("returns 401 when the user is NOT an admin", async () => {
			gheNock
				.get("/api/v3")
				.matchHeader("Authorization", "Bearer myToken")
				.reply(200);

			when(verifyAdminPermsAndFinishInstallation).calledWith(
				"myToken", installation, gitHubServerApp.id, subscription.gitHubInstallationId + 1, expect.anything()
			).mockResolvedValue({ error: "not admin" });

			const result = await supertest(app)
				.post(`/github/${gitHubServerApp.uuid}/configuration`)
				.query({
					jwt: await generateJwt()
				})
				.set("Cookie", generateSignedSessionCookieHeader({
					githubToken: "myToken",
					gitHubUuid: gitHubServerApp.uuid
				}))
				.send({
					installationId: subscription.gitHubInstallationId + 1
				});
			expect(result.status).toStrictEqual(401);
		});

		it("creates subscription when the user is an admin", async () => {
			gheNock
				.get("/api/v3")
				.matchHeader("Authorization", "Bearer myToken")
				.reply(200);

			when(verifyAdminPermsAndFinishInstallation).calledWith(
				"myToken", installation, gitHubServerApp.id, subscription.gitHubInstallationId + 1, expect.anything()
			).mockResolvedValue({  });

			const result = await supertest(app)
				.post(`/github/${gitHubServerApp.uuid}/configuration`)
				.query({
					jwt: await generateJwt()
				})
				.set("Cookie", generateSignedSessionCookieHeader({
					githubToken: "myToken",
					gitHubUuid: gitHubServerApp.uuid
				}))
				.send({
					installationId: subscription.gitHubInstallationId + 1
				});
			expect(result.status).toStrictEqual(200);
		});
	});
});
