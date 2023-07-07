import { createRestApi } from "../api/rest-api";

const restApi = createRestApi();

export {
	startOAuth
};

async function startOAuth(onDone: () => void) {
	const onSuccess = (evt: MessageEvent) => {
		restApi.storeGitHubToken({ gitHubAccessToken: evt?.data?.gitHubAccessToken });
		window.removeEventListener("message", onSuccess);
		onDone();
	};
	window.addEventListener("message", onSuccess);
	const oauthUrl = await restApi.generateOAuthUrl();
	window.open(oauthUrl, "_blank");
};
