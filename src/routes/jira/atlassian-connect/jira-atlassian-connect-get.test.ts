import supertest from "supertest";
import express, { Express } from "express";
import { getFrontendApp } from "~/src/app";
import { getLogger } from "config/logger";

describe("Atlassian Connect", () => {
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
			app.use(getFrontendApp());
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
					});
			});

		});
	});

});
