import supertest from "supertest";
import express, { Express } from "express";
import setupFrontend from "../../../src/frontend/app";
import {getLogger} from "../../../src/config/logger";

jest.mock("../../../src/config/feature-flags");

describe("Connect", () => {
	let app: Express;

	beforeEach(() => {

		app = express();
		app.use((request, _, next) => {
			request.log = getLogger("test");
			next();
		});
	});

	describe("Frontend", () => {
		beforeEach(() => {
			app.use("/", setupFrontend({
				getSignedJsonWebToken: () => "",
				getInstallationAccessToken: async () => ""
			}));
		});

		describe("Atlassian Connect", () => {
			it("should return correct connect app descriptor", () => {

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
