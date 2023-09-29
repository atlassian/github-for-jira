import Api from "../../api";
import { AxiosError } from "axios";
import { popup, reportError } from "../../utils";
import { CheckOrgOwnershipResponse } from "../../../../src/rest-interfaces";

let username: string | undefined;
let email: string | undefined;

let oauthState: string | undefined;

async function checkValidity(): Promise<boolean | AxiosError> {
	if (!Api.token.hasGitHubToken()) return false;

	try {
		const res = await Api.gitHub.getUserDetails();
		username = res.data.login;
		email = res.data.email;

		const ret = res.status === 200;

		if(!ret) {
			reportError({
				message: "Response status is not 200 for getting user details", status: res.status
			}, {
				path: "checkValidity"
			});
		}

		return ret;

	} catch (e: unknown) {
		reportError(new Error("Fail checkValidity", { cause: e }), { path: "checkValidity" });
		return e as AxiosError;
	}
}

async function checkGithubOwnership(githubInstallationId: number): Promise<CheckOrgOwnershipResponse | AxiosError> {
	if (!Api.token.hasGitHubToken()) return { isAdmin: false, orgName: "" };

	try {
		const res = await Api.orgs.checkOrgOwnership(githubInstallationId);
		const ret = res.status === 200;

		if(!ret) {
			reportError({
				message: "Response status is not 200 when checking GitHub ownership", status: res.status
			}, {
				path: "checkGithubOwnership"
			});
		}

		return { isAdmin: ret, orgName: res.data.orgName };
	} catch (e: unknown) {
		if ((e as any).response.status === 403) {
			return { isAdmin: false, orgName: (e as any).response.data.orgName };
		}
		reportError(new Error("Fail checkGithubOwnership", { cause: e }), { path: "checkGithubOwnership" });
		return e as AxiosError;
	}
}

async function authenticateInGitHub(onWinClosed: () => void): Promise<void> {
	const res = await Api.auth.generateOAuthUrl();
	if (res.data.redirectUrl && res.data.state) {
		oauthState = res.data.state;
		const win = popup(res.data.redirectUrl);
		if (win) {
			const winCloseCheckHandler = setInterval(() => {
				if (win.closed) {
					clearInterval(winCloseCheckHandler);
					try {
						onWinClosed();
					} catch (e: unknown) {
						reportError(new Error("Fail authenticateInGitHub", { cause: e }), {
							path: "authenticateInGitHub",
							reason: "error in onWinClosed"
						});
					}
				}
			}, 1000);
		}
	} else {
		reportError({
			message: "Empty redirectUrl and/or state"
		}, {
			path: "authenticateInGitHub",
			isRedirectUrlEmpty: !res.data?.redirectUrl,
			isStateEmpty: !res.data.state
		});
	}
}

async function finishOAuthFlow(code: string, state: string): Promise<boolean | AxiosError> {

	if (!code && !state) {
		reportError({
			message: "code or state missing"
		}, {
			path: "finishOAuthFlow",
			isCodeEmpty: !code,
			isStateEmpty: !state
		});
		return false;
	}

	const prevState = oauthState;
	oauthState = undefined;

	if (state !== prevState) {
		reportError({
			message: "state not match"
		}, {
			path: "finishOAuthFlow",
			isPrevStateEmpty: !prevState,
			isStateEmpty: !state
		});
		return false;
	}

	try {
		const token = await Api.auth.exchangeToken(code, state);
		if (token.data.accessToken) {
			Api.token.setGitHubToken(token.data.accessToken);
			return true;
		} else {
			reportError({ message: "fail to acquire accessToken (empty)" }, { path: "finishOAuthFlow", });
			return false;
		}
	} catch (e: unknown) {
		reportError(new Error("Fail exchangeToken", { cause: e }), { path: "finishOAuthFlow" });
		return e as AxiosError;
	}
}

function getUserDetails() {
	return {
		username,
		email
	};
}

function clear() {
	Api.token.clearGitHubToken();
	username = undefined;
	email = undefined;
}

export default {
	checkValidity,
	checkGithubOwnership,
	authenticateInGitHub,
	finishOAuthFlow,
	getUserDetails,
	clear
};

