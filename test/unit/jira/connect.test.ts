import supertest from "supertest";
import express, { Express } from "express";
import setupFrontend from "../../../src/frontend/app";
import { booleanFlag, BooleanFlags } from "../../../src/config/feature-flags";
import { when } from "jest-when";

jest.mock("../../../src/config/feature-flags");

describe("Connect", () => {
	let app: Express;

	const whenSignedInstallCallbacks = (value: boolean) =>
		when(booleanFlag).calledWith(
			BooleanFlags.USE_JWT_SIGNED_INSTALL_CALLBACKS,
			expect.anything()
		).mockResolvedValue(value);

	beforeEach(() => {
		// Defaults maintenance mode to true
		whenSignedInstallCallbacks(true);
		app = express();
	});

	describe("Frontend", () => {
		beforeEach(() => {
			app.use("/", setupFrontend({
				getSignedJsonWebToken: () => "",
				getInstallationAccessToken: async () => ""
			}));
		});

		describe("Atlassian Connect", () => {
			it("should return Atlassian Connect with signed-install:true when feature flag is off", () => {
				whenSignedInstallCallbacks(false);

				return supertest(app)
					.get("/jira/atlassian-connect.json")
					.expect(200)
					.then(response => {
						// removing keys that changes for every test run
						delete response.body.baseUrl;
						delete response.body.name;
						delete response.body.key;
						expect(response.body).toMatchSnapshot();
					})
			});

			it("should return Atlassian Connect with signed-install:true when feature flag is on", () => {

				whenSignedInstallCallbacks(true)

				return supertest(app)
					.get("/jira/atlassian-connect.json")
					.expect(200)
					.then(response => {
						// removing keys that changes for every test run
						delete response.body.baseUrl;
						delete response.body.name;
						delete response.body.key;
						expect(response.body).toMatchSnapshot();
					})
			});
		});

	});
});
