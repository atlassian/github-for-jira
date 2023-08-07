/* eslint-disable jest/expect-expect */
import supertest from "supertest";
import { getFrontendApp } from "~/src/app";
import { Application } from "express";

describe("Github Setup 5ku redirector", () => {
	let frontendApp: Application;

	beforeEach(async () => {
		frontendApp = getFrontendApp();
	});

	describe("#GET", () => {

		it("should notify page on success org installation", async () => {
			await supertest(frontendApp).get("/github/setup?installation_id=12345")
				.set("Cookie", ["is-spa=true;"])
				.expect("set-cookie", "is-spa=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT")
				.expect(302)
				.expect("location", "/rest/app/cloud/github-installed?installation_id=12345");
		});

		it("should notify page on requested org installation", async () => {
			await supertest(frontendApp).get("/github/setup?setup_action=request")
				.set("Cookie", ["is-spa=true;"])
				.expect("set-cookie", "is-spa=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT")
				.expect(302)
				.expect("location", "/rest/app/cloud/github-requested?setup_action=request");
		});

	});

});
