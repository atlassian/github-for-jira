import axios from "axios";
import { getJiraJWT } from "../utils";

const THIRTY_SECONDS_IN_MS = 30_000;

const axiosRestWithNoJwt = axios.create({ timeout: THIRTY_SECONDS_IN_MS });
const axiosRest = axios.create({
	timeout: THIRTY_SECONDS_IN_MS
});
// Adding the token in the headers through interceptors because it is an async value
axiosRest.interceptors.request.use(async (config) => {
	config.headers.Authorization = await getJiraJWT();
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
	timeout: THIRTY_SECONDS_IN_MS
});
axiosGitHub.interceptors.request.use(async (config) => {
	config.headers["Authorization"] = `Bearer ${gitHubToken}`;
	return config;
});

const axiosRestWithGitHubToken = axios.create({
	timeout: THIRTY_SECONDS_IN_MS
});
axiosRestWithGitHubToken.interceptors.request.use(async (config) => {
	config.headers.Authorization = await getJiraJWT();
	config.headers["github-auth"] = gitHubToken;
	return config;
});

const axiosRestWithNoJwtButWithGitHubToken = axios.create({
	timeout: THIRTY_SECONDS_IN_MS
});
axiosRestWithNoJwtButWithGitHubToken.interceptors.request.use(async (config) => {
	config.headers["github-auth"] = gitHubToken;
	return config;
});

export {
	axiosGitHub,
	axiosRest,
	axiosRestWithNoJwt,
	axiosRestWithNoJwtButWithGitHubToken,
	axiosRestWithGitHubToken,
	clearGitHubToken,
	setGitHubToken,
	hasGitHubToken,
};
