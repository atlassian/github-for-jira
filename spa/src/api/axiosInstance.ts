import axios from "axios";
import { getJiraJWT } from "../utils";

const TEN_SECONDS_IN_MS = 10_000;

const axiosRest = axios.create({
	timeout: TEN_SECONDS_IN_MS
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
let lastTokenGeneratedTime: number | undefined = undefined;

const clearGitHubToken = () => {
	gitHubToken = undefined;
	lastTokenGeneratedTime = new Date().getTime();
};

const setGitHubToken = (newToken: string) => {
	gitHubToken = newToken;
	lastTokenGeneratedTime = new Date().getTime();
};

const hasGitHubToken = () => !!gitHubToken;

const getLastTokenGeneratedTime = () => lastTokenGeneratedTime;

const axiosGitHub = axios.create({
	timeout: TEN_SECONDS_IN_MS
});
axiosGitHub.interceptors.request.use(async (config) => {
	config.headers["Authorization"] = `Bearer ${gitHubToken}`;
	return config;
});

const axiosRestWithGitHubToken = axios.create({
	timeout: TEN_SECONDS_IN_MS
});
axiosRestWithGitHubToken.interceptors.request.use(async (config) => {
	config.headers.Authorization = await getJiraJWT();
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
	getLastTokenGeneratedTime,
};
