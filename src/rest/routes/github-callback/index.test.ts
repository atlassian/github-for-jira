import supertest from "supertest";
import { getFrontendApp } from "~/src/app";

describe("rest oauth router", () => {
	let app;
	beforeEach(() => {
		app = getFrontendApp();
	});
	describe("rest oauth callback", () => {
		describe("cloud", () => {
			it("should prevent xss attack", async () => {
				const code = "<script>alert('hello')</scripts>";
				const state = "<script>alert('hello')</scripts>";

				const resp = await supertest(app)
					.get(`/rest/app/cloud/github-callback?code=${code}&state=${state}`)
					.expect("content-type", "text/html; charset=utf-8");

				expect(resp.text).not.toEqual(expect.stringContaining("alert"));

			});
			it("should exchange for github access token", async () => {
				const code = "abcd";
				const state = "qwer";

				const resp = await supertest(app)
					.get(`/rest/app/cloud/github-callback?code=${code}&state=${state}`)
					.expect("content-type", "text/html; charset=utf-8");

				expect(resp.text).toEqual(expect.stringContaining(
					`window.opener.postMessage({"type":"oauth-callback","code":"abcd","state":"qwer"}`
				));

			});
			describe("org installation success", () => {
				it("should notify for org installed", async () => {

					const resp = await supertest(app)
						.get(`/rest/app/cloud/github-installed?installation_id=12345`)
						.expect("content-type", "text/html; charset=utf-8");

					expect(resp.text).toEqual(expect.stringContaining(
						`window.opener.postMessage({"type":"install-callback","gitHubInstallationId":"12345"}`
					));

				});
			});
			describe("org installation requested", () => {
				it("should notify for org installation requested", async () => {

					const resp = await supertest(app)
						.get(`/rest/app/cloud/github-requested?setup_action=request`)
						.expect("content-type", "text/html; charset=utf-8");

					expect(resp.text).toEqual(expect.stringContaining(
						`window.opener.postMessage({"type":"install-requested","setupAction":"request"}`
					));

				});
			});
		});
	});
});
