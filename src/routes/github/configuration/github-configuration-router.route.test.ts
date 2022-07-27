import express, { Application } from "express";
import { GithubConfigurationRouter } from "./github-configuration-router";
import { GithubConfigurationGet } from "./github-configuration-get";
import { GithubConfigurationPost } from "./github-configuration-post";

jest.mock("./github-configuration-get");
jest.mock("./github-configuration-post");

import supertest from "supertest";

describe("GitHub Configuration Router", () => {
	let app: Application;
	beforeEach(() => {
		app = express();
		app.use("/configuration", GithubConfigurationRouter);
	});
	describe("Routing on GET", () => {
		it("should hit the configuration on GET", async () => {
			jest.mocked(GithubConfigurationGet).mockImplementation(async (_req, res) => {res.end("ok");});
			await supertest(app).get("/configuration");
			expect(GithubConfigurationGet).toHaveBeenCalled();
		});
		it("should hit the configuration on POST", async () => {
			jest.mocked(GithubConfigurationPost).mockImplementation(async (_req, res) => {res.end("ok");});
			await supertest(app).post("/configuration");
			expect(GithubConfigurationPost).toHaveBeenCalled();
		});
	});
});

