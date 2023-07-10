import { GetRedirectUrlResponse } from "../rest-interfaces/oauth-types";

export function createRestApi() {

	let gitHubAccessToken: string | undefined;
	let gitHubRefreshToken: string | undefined;

	return {
		storeGitHubToken,
		isTokenStillValid,
		generateOAuthUrl,
		fetchInstalledOrganisations
	};

	function storeGitHubToken(tokens: { gitHubAccessToken: string; githubRefreshToken?: string }) {
		gitHubAccessToken = tokens.gitHubAccessToken;
		gitHubRefreshToken = tokens.githubRefreshToken;
	}

	async function isTokenStillValid() {

		try {
			const resp = await fetch("https://api.github.com/user", {
				headers: {
					Authorization: `Bearer ${gitHubAccessToken}`
				}
			});
			if (!resp.ok) {
				console.log("Token invalid");
				return false;
			} else {
				console.log("Token still valid");
				return true;
			}
		} catch (e) {
			console.log("Some network error on the request", e);
			return false;
		}
	}

	async function generateOAuthUrl() {
		try {

			const jiraJwt = await getNewJiraToken();

			const resp = await fetch("/rest/app/cloud/oauth/redirecturl", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${jiraJwt}###${gitHubAccessToken}`
				}
			});
			if (!resp.ok) {
				return { success: false, orgs: [] };
			} else {
				const { redirectUrl } = await resp.json() as GetRedirectUrlResponse;
				return { success: true, redirectUrl };
			}
		} catch (e) {
			console.log("Some network error on the request", e);
			return { success: false, orgs: [] };
		}
	}

	async function fetchInstalledOrganisations() {

		try {

			const jiraJwt = await getNewJiraToken();

			const resp = await fetch("/rest/app/cloud/organizations", {
				headers: {
					Authorization: `Bearer ${jiraJwt}###${gitHubAccessToken}`
				}
			});
			if (!resp.ok) {
				return { success: false, orgs: [] };
			} else {
				console.log("Token still valid");
				return { success: true, orgs: resp.json() };
			}
		} catch (e) {
			console.log("Some network error on the request", e);
			return { success: false, orgs: [] };
		}

	}

}

async function getNewJiraToken() {
	return new Promise((resolve) => {
		window.AP.context.getToken((token: string) => {
			resolve(token);
		});
	});
}
