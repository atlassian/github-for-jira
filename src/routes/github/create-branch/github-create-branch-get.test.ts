import express, { Application } from "express";
import { GithubCreateBranchGet } from "./github-create-branch-get";
import supertest from "supertest";

jest.mock("./github-create-branch-get");

describe("GitHub Create Branch Get", () => {
	let app: Application;
	beforeEach(() => {
		app = express();
		app.use("/create-branch", GithubCreateBranchGet);

	});
	describe("Testing the GET route", () => {
		it("should hit the create branch on GET", async () => {
			jest.mocked(GithubCreateBranchGet).mockImplementation(async (_req, res) => {res.end("ok");});
			await supertest(app).get("/create-branch");
			expect(GithubCreateBranchGet).toHaveBeenCalled();
		});
	});
});

