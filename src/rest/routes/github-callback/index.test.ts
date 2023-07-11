import supertest from "supertest";
import { getFrontendApp } from "~/src/app";

describe("rest oauth router", () => {
	let app;
	beforeEach(async () => {
		app = getFrontendApp();
	});
	describe("rest oauth callback", () => {
		describe("cloud", () => {
			it("should exchange for github access token", async () => {
				const code = "abcd";
				const state = "qwer";

				const resp = await supertest(app)
					.get(`/rest/app/cloud/github-callback?code=${code}&state=${state}`)
					.expect("content-type", "text/html; charset=utf-8");

				expect(resp.text).toEqual(expect.stringContaining(
					`window.opener.postMessage({"code":"abcd","state":"qwer"}`
				));

			});
		});
	});
});
