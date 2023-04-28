import supertest from "supertest";
import { Express } from "express";
import { getFrontendApp } from "../../app";

describe("Session GET", () => {
	let app: Express;

	beforeEach(() => {
		app = getFrontendApp();
	});

	describe("Frontend", () => {
		it("Testing loading when redirecting to GitHub", () =>
			supertest(app)
				.get("/session/jira/atlassian-connect.json?ghRedirect=to&foo=bar&ice=berg")
				.expect(200)
				.then((response) => {
					expect(response.text.includes("Redirecting to your GitHub Enterprise Server instance")).toBeTruthy();
					expect(response.text.includes("Receiving data from your GitHub Enterprise Server")).toBeFalsy();
					expect(response.text.includes("Redirecting to GitHub Cloud")).toBeFalsy();
					expect(response.text.includes("window.location = \"https://test-github-app-instance.com/jira/atlassian-connect.json?ghRedirect=to&foo=bar&ice=berg\"")).toBeTruthy();
				})
		);

		it("Testing loading when redirecting from GitHub", () =>
			supertest(app)
				.get("/session/jira/atlassian-connect.json?ghRedirect=from&foo=bar&ice=berg")
				.expect(200)
				.then(response => {
					expect(response.text.includes("Retrieving data from your GitHub Enterprise Server")).toBeTruthy();
					expect(response.text.includes("Redirecting to your GitHub Enterprise Server instance")).toBeFalsy();
					expect(response.text.includes("Redirecting to GitHub Cloud")).toBeFalsy();
					expect(response.text.includes("window.location = \"https://test-github-app-instance.com/jira/atlassian-connect.json?ghRedirect=from&foo=bar&ice=berg\"")).toBeTruthy();
				})
		);

		it("Testing removing resetSession from query params", () =>
			supertest(app)
				.get("/session/jira/atlassian-connect.json?ghRedirect=from&foo=bar&ice=berg&resetSession=true")
				.set("Cookie", ["session=blah", "foo=bar"])
				.expect(200)
				.then(response => {
					expect(response.text.includes("Retrieving data from your GitHub Enterprise Server")).toBeTruthy();
					expect(response.text.includes("Redirecting to your GitHub Enterprise Server instance")).toBeFalsy();
					expect(response.headers["set-cookie"]).not.toContain("blah");
					expect(response.text.includes("Redirecting to GitHub Cloud")).toBeFalsy();
					expect(response.text.includes("window.location = \"https://test-github-app-instance.com/jira/atlassian-connect.json?ghRedirect=from&foo=bar&ice=berg\"")).toBeTruthy();
				})
		);

		it("Testing loading when no query params", () =>
			supertest(app)
				.get("/session/jira/atlassian-connect.json")
				.expect(200)
				.then(response => {
					expect(response.text.includes("Redirecting to GitHub Cloud")).toBeTruthy();
					expect(response.text.includes("Retrieving data from your GitHub Enterprise Server")).toBeFalsy();
					expect(response.text.includes("Redirecting to your GitHub Enterprise Server instance")).toBeFalsy();
					expect(response.text.includes("window.location = \"https://test-github-app-instance.com/jira/atlassian-connect.json\"")).toBeTruthy();
				}));

		it("Testing the route just `session` when no query params", () =>
			supertest(app)
				.get("/session")
				.expect(200)
				.then(response => {
					expect(response.text.includes("Redirecting to GitHub Cloud")).toBeTruthy();
					expect(response.text.includes("Retrieving data from your GitHub Enterprise Server")).toBeFalsy();
					expect(response.text.includes("Redirecting to your GitHub Enterprise Server instance")).toBeFalsy();
					expect(response.text.includes("window.location = \"https://test-github-app-instance.com/\"")).toBeTruthy();
				}));

		it("Testing the route just `session` with query params", () =>
			supertest(app)
				.get("/session?foo=bar&what=ever")
				.expect(200)
				.then(response => {
					expect(response.text.includes("Redirecting to GitHub Cloud")).toBeTruthy();
					expect(response.text.includes("Retrieving data from your GitHub Enterprise Server")).toBeFalsy();
					expect(response.text.includes("Redirecting to your GitHub Enterprise Server instance")).toBeFalsy();
					expect(response.text.includes("window.location = \"https://test-github-app-instance.com/?foo=bar&what=ever\"")).toBeTruthy();
				}));
	});
});
