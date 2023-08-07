import Api from "../../api";
import { OrganizationsResponse } from "rest-interfaces";
import { AxiosError } from "axios";
import { popup, reportError } from "../../utils";

const FIFTEEN_MINUTES_IN_MS = 15 * 60 * 1000;

async function fetchOrgs(): Promise<OrganizationsResponse | AxiosError> {
	if (!Api.token.hasGitHubToken()) return { orgs: [] };

	try {
		const response = await Api.orgs.getOrganizations();
		return response.data;
	} catch (e) {
		reportError(e);
		return e as AxiosError;
	}
}

async function connectOrg(orgId: number): Promise<boolean | AxiosError> {
	if (!Api.token.hasGitHubToken()) return false;

	try {
		const response = await Api.orgs.connectOrganization(orgId);
		return response.status === 200;
	} catch (e) {
		reportError(e);
		return e as AxiosError;
	}
}

async function installNewApp(callbacks: {
	onFinish: (gitHubInstallationId: number | undefined) => void,
	onRequested: (setupAction: string) => void
}): Promise<void> {
	const app = await Api.app.getAppNewInstallationUrl();
	const exp = new Date(new Date().getTime() + FIFTEEN_MINUTES_IN_MS);
	document.cookie = `is-spa=true; expires=${exp.toUTCString()}; path=/; SameSite=None; Secure`;

	const handler = async (event: MessageEvent) => {
		if (event.data?.type === "install-callback" && event.data?.gitHubInstallationId) {
			const id = parseInt(event.data?.gitHubInstallationId);
			callbacks.onFinish(isNaN(id) ? undefined : id);
		}
		if (event.data?.type === "install-requested" && event.data?.setupAction) {
			const setupAction = event.data?.setupAction;
			callbacks.onRequested(setupAction);
		}
	};
	window.addEventListener("message", handler);

	const winInstall = popup(app.data.appInstallationUrl, { width: 1024, height: 760 });

	// Still need below interval for window close
	// As user might not finish the app install flow, there's no guarantee that above message
	// event will happen.
	const hdlWinInstall = setInterval(() => {
		if (winInstall?.closed) {
			try {
				document.cookie = "is-spa=;expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=None; Secure";
				setTimeout(() => window.removeEventListener("message", handler), 1000); //give time for above message handler to kick off
			} catch (e) {
				reportError(e);
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
