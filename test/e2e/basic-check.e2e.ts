import { expect, test } from "@playwright/test";
import { GithubClient } from "test/e2e/utils/github-client";
import { deleteDevInfoDataByInstallationId } from "test/e2e/utils/helpers";

const githubClient = new GithubClient({
	oauthToken: process.env.GITHUB_OAUTH_TOKEN,
});

const ORGANIZATION = "e2e-testing";
const REPO_NAME = "e2e";
const GITHUB_INSTALLATION_ID = "26788391";

async function deleteGitHubRepo() {
	await githubClient.deleteRepository(ORGANIZATION, REPO_NAME);
}

test("basic test", async ({ page }) => {
	const hostUrl = "https://rachelle-local.public.atlastunnel.com";
	console.info(`Using App URL: ${hostUrl}`);

	await deleteGitHubRepo();
	await deleteDevInfoDataByInstallationId(GITHUB_INSTALLATION_ID);
});
