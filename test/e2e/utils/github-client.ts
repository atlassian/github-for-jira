/*
import { Builder, Builder as HttpClient } from "httplease";

interface ConstructorParameters {
	oauthToken: string;
	baseUrl?: string;
}

async function decorateAndFire(builder: Builder) {
	console.log(
		builder.config.method,
		builder.config.baseUrl,
		builder.config.path
	);
	return builder
		.withExpectStatus([200, 201, 202])
		.withBufferJsonResponseHandler()
		.send()
		.then((response) => {
			console.log(
				"Received successful response",
				response.statusCode,
				JSON.stringify(response.body)
			);
			return Promise.resolve(response.body);
		})
		.catch((err) => {
			console.log(JSON.stringify(err));
			throw err;
		});
}

function base64encode(str: string) {
	return Buffer.from(str, "utf-8").toString("base64");
}

export class GithubClient {
	httpClient: HttpClient;
	baseUrl = "https://api.github.com";
	oauthToken: string;

	constructor({ oauthToken, baseUrl }: ConstructorParameters) {
		this.oauthToken = oauthToken;
		if (baseUrl) {
			this.baseUrl = baseUrl;
		}
		const requestHeaders = {
			Authorization: `Bearer ${oauthToken}`,
			accept: "application/vnd.github.v3+json",
			"user-agent": "playwright",
		};

		this.httpClient = new HttpClient()
			.withBaseUrl(this.baseUrl)
			.withHeaders(requestHeaders)
			.withExpectStatus([204])
			.withTimeout(30000);
	}

	async createRepository(
		organisationSlug: string,
		newRepoSlug: string
	): Promise<void> {
		await decorateAndFire(
			this.httpClient
				.withPath(`/orgs/${organisationSlug}/repos`)
				.withMethodPost()
				.withJsonBody({
					name: newRepoSlug,
					private: true,
					auto_init: true,
				})
		);
	}

	async fetchRepoSlugs(organisationSlug: string): Promise<Array<string>> {
		let repoSlugs: Array<string> = [];
		let currPageNo = 1;
		let response: Array<{ name: string }>;
		do {
			response = await decorateAndFire(
				this.httpClient
					.withPath(`/orgs/${organisationSlug}/repos?page=${currPageNo}`)
					.withMethodGet()
			);
			repoSlugs = repoSlugs.concat(response.map((repo) => repo.name));
			currPageNo++;
		} while (response.length > 0);
		return Promise.resolve(repoSlugs);
	}

	async deleteRepository(
		organisationId: string,
		repositoryId: string | undefined
	): Promise<string> {
		if (repositoryId === undefined) {
			return "";
		}
		return this.httpClient
			.withPath(`/repos/${organisationId}/${repositoryId}`)
			.withMethodDelete()
			.withDiscardBodyResponseHandler()
			.send()
			.catch((err) => {
				// Getting a 404 from the githubClient.deleteRepository function is not a sign of problem.
				// If the deletion works at the end of the check, the first deletion will return a 404 - which is expected since there will be no repo.
				if (err.response.statusCode === 404) {
					console.log(`deleteRepository returned 404`);
				} else {
					console.log(err);
				}
			});
	}

	_getMasterBranchName(): string {
		return this.baseUrl.indexOf("github.com") >= 0 ? "main" : "master";
	}

	async getLastMasterCommitSha(
		organisationSlug: string,
		repositorySlug: string
	): Promise<string> {
		const path = `/repos/${organisationSlug}/${repositorySlug}/commits/${this._getMasterBranchName()}`;
		const commits = await decorateAndFire(
			this.httpClient.withPath(path).withMethodGet()
		);
		return commits.sha;
	}

	async createBranch(
		organisationSlug: string,
		repositorySlug: string,
		branchName: string
	): Promise<void> {
		await decorateAndFire(
			this.httpClient
				.withPath(`/repos/${organisationSlug}/${repositorySlug}/git/refs`)
				.withMethodPost()
				.withJsonBody({
					ref: `refs/heads/${branchName}`,
					sha: await this.getLastMasterCommitSha(
						organisationSlug,
						repositorySlug
					),
				})
		);
	}

	async createPullRequest(
		organisationSlug: string,
		repositorySlug: string,
		branchName: string,
		title: string,
		body: string
	): Promise<string> {
		const newPR = await decorateAndFire(
			this.httpClient
				.withPath(`/repos/${organisationSlug}/${repositorySlug}/pulls`)
				.withMethodPost()
				.withJsonBody({
					title: title,
					body: body,
					head: branchName,
					base: this._getMasterBranchName(),
				})
		);

		return newPR.number;
	}

	async commitNewFile(
		organisationSlug: string,
		repositorySlug: string,
		branchName: string,
		filePath: string,
		commitMessage: string,
		newContent: string
	): Promise<string> {
		const newFileInfo = await decorateAndFire(
			this.httpClient
				.withPath(
					`/repos/${organisationSlug}/${repositorySlug}/contents/${filePath}`
				)
				.withMethodPut()
				.withJsonBody({
					message: commitMessage,
					content: base64encode(newContent),
					branch: branchName,
				})
		);

		return newFileInfo.content.sha;
	}

	async getLastCommitSha(
		organisationSlug: string,
		repositorySlug: string,
		filePath: string
	): Promise<string> {
		const path = `/repos/${organisationSlug}/${repositorySlug}/contents/${filePath}`;
		return (
			await decorateAndFire(this.httpClient.withPath(path).withMethodGet())
		).sha;
	}

	async updateFile(
		organisationSlug: string,
		repositorySlug: string,
		branchName: string,
		filePath: string,
		commitMessage: string,
		newContent: string
	): Promise<string> {
		const response = await decorateAndFire(
			this.httpClient
				.withPath(
					`/repos/${organisationSlug}/${repositorySlug}/contents/${filePath}`
				)
				.withMethodPut()
				.withJsonBody({
					message: commitMessage,
					content: base64encode(newContent),
					branch: branchName,
					sha: await this.getLastCommitSha(
						organisationSlug,
						repositorySlug,
						filePath
					),
				})
		);

		return response.content.sha;
	}
}
*/
