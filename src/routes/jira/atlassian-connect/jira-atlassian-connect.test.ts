import supertest from "supertest";
import express, { Express } from "express";
import { getFrontendApp } from "~/src/app";
import { getLogger } from "config/logger";
import { when } from "jest-when";
import { booleanFlag, BooleanFlags } from "~/src/config/feature-flags";
import { getCloudIdFromClientInfo } from "routes/jira/atlassian-connect/jira-atlassian-connect-get";

jest.mock("config/feature-flags");

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

		describe.each([true, false])("Atlassian Connect", (createBranch) => {

			beforeEach(() => {
				when(booleanFlag).calledWith(
					BooleanFlags.CREATE_BRANCH,
					expect.anything(),
					expect.anything()
				).mockResolvedValue(createBranch);
			});

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

	describe("getCloudIdFromClientInfo", () => {

		it("should return undefined if no value passed", () => {
			expect(getCloudIdFromClientInfo()).toBe(undefined);
		});

		it("should return undefined if no cloudId found", () => {
			const mockInfoWithoutCloudId = "client=upm,ondemand=true,entitlementId=e7b1797f-5822-4baa-a675-cf6cf8d80bcd,someID=03ce73f8-41fc-492e-9983-83ab6d8ebd32";
			expect(getCloudIdFromClientInfo(mockInfoWithoutCloudId)).toBe(undefined);
		});

		it("should find cloud id from string", () => {
			const cloudId = "03ce73f8-41fc-492e-9983-83ab6d8ebd32";
			const mockInfoWithCloudId = "client=upm,ondemand=true,entitlementId=e7b1797f-5822-4baa-a675-cf6cf8d80bcd,cloudId=03ce73f8-41fc-492e-9983-83ab6d8ebd32";
			expect(getCloudIdFromClientInfo(mockInfoWithCloudId)).toBe(cloudId);
		});
	});
});
