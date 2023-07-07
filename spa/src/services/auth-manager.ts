import { createRestApi } from "../api/rest-api";

const restApi = createRestApi();

export {
};

async function startOAuth(onDone: () => void) {
	window.addEventListener("message", (evt: MessageEvent) => {
		restApi.storeGitHubToken({ gitHubAccessToken: evt?.data?.gitHubAccessToken });
		onDone();
	});
	const oauthUrl = await restApi.generateOAuthUrl();
	window.open(oauthUrl, "_blank");
};
