import axios from "axios";

const getHeaders = (): Promise<string> => new Promise(resolve => {
	AP.context.getToken((token: string) => {
		resolve(token);
	});
});

const axiosRest = axios.create({
	timeout: 3000
});
// Adding the token in the headers through interceptors because it is an async value
axiosRest.interceptors.request.use(async (config) => {
	config.headers.Authorization = await getHeaders();
	return config;
});

/*
 * IMPORTANT
 * This is a secret store of the github access token
 * DO NOT export/exposed this store
 * Only write operation is allowed
 */
let gitHubToken: string | undefined = undefined;

const clearGitHubToken = () => {
	gitHubToken = undefined;
};

const setGitHubToken = (newToken: string) => {
	gitHubToken = newToken;
};

const hasGitHubToken = () => !!gitHubToken;

const axiosGitHub = axios.create({
	timeout: 3000
});
axiosGitHub.interceptors.request.use(async (config) => {
	config.headers["Authorization"] = `Bearer ${gitHubToken}`;
	return config;
});

const axiosRestWithGitHubToken = axios.create({
	timeout: 3000
});
axiosRestWithGitHubToken.interceptors.request.use(async (config) => {
	config.headers.Authorization = await getHeaders();
	config.headers["github-auth"] = gitHubToken;
	return config;
});

export {
	axiosGitHub,
	axiosRest,
	axiosRestWithGitHubToken,
	clearGitHubToken,
	setGitHubToken,
	hasGitHubToken,
};
