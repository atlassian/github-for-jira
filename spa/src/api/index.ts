import Token from "./token";
import GitHubAuth from "./auth";
import GitHubApps from "./apps";

const ApiRequest = {
	token: Token,
	githubAuth: GitHubAuth,
	gitHubApp: GitHubApps,
};

export default ApiRequest;
