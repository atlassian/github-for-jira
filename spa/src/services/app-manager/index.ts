import Api from "../../api";
import { OrganizationsResponse } from "../../rest-interfaces/oauth-types";

const FIFTEEN_MINUTES_IN_MS = 15 * 60 * 1000;

async function fetchOrgs(): Promise<OrganizationsResponse | undefined> {
	if (!Api.token.hasGitHubToken()) return { orgs: [] };

	try {
		const response = await Api.orgs.getOrganizations();
		return response.data;
	} catch (e) {
		console.error(e, "Failed to fetch organizations");
		return undefined;
	}
}

async function connectOrg(orgId: number): Promise<boolean> {
	if (!Api.token.hasGitHubToken()) return false;

	try {
		const response = await Api.orgs.connectOrganization(orgId);
		return response.status === 200;
	} catch (e) {
		console.error(e, "Failed to fetch organizations");
		return false;
	}
}

async function installNewApp(onFinish: (gitHubInstallationId: number | undefined) => void): Promise<void> {
	const app = await Api.app.getAppNewInstallationUrl();
	const exp = new Date(new Date().getTime() + FIFTEEN_MINUTES_IN_MS);
	document.cookie = `is-spa=true; expires=${exp.toUTCString()}; path=/; SameSite=None; Secure`;

	const handler = async (event: MessageEvent) => {
		if (event.data?.type === "install-callback" && event.data?.gitHubInstallationId) {
			const id = parseInt(event.data?.gitHubInstallationId);
			onFinish(isNaN(id) ? undefined : id);
		}
	};
	window.addEventListener("message", handler);

	const winInstall = window.open(app.data.appInstallationUrl, "_blank");

	//Still need bellow interval for window close
	//As user might not finish the app install flow, there'no gurantee that above message
	//event will happened.
	const hdlWinInstall = setInterval(() => {
		if (winInstall?.closed) {
			try {
				document.cookie = "is-spa=;expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=None; Secure";
				setTimeout(() => window.removeEventListener("message", handler), 1000); //give time for above message handler to kick off
			} finally {
				clearInterval(hdlWinInstall);
			}
		}
	}, 1000);
}

export default {
	fetchOrgs,
	connectOrg,
	installNewApp
};
