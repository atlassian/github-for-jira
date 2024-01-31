import Api from "../../api";
import { OrganizationsResponse } from "rest-interfaces";
import { AxiosError } from "axios";
import { popup, reportError } from "../../utils";

async function fetchOrgs(): Promise<OrganizationsResponse | AxiosError> {

	if (!Api.token.hasGitHubToken()) return { orgs: [] };

	try {
		const response = await Api.orgs.getOrganizations();
		return response.data;
	} catch (e: unknown) {
		reportError(new Error("Fail fetchOrgs", { cause: e } ), { path: "fetchOrgs" });
		return e as AxiosError;
	}
}

async function connectOrg(orgId: number): Promise<boolean | AxiosError> {

	if (!Api.token.hasGitHubToken()) {
		reportError({ message: "Api github token is empty" }, { path: "connectOrg" });
		return false;
	}

	try {

		const response = await Api.orgs.connectOrganization(orgId);
		const ret = response.status === 200;

		if(!ret) {
			reportError(
				{ message: "Response status for connecting org is not 200", status: response.status },
				{ path: "connectOrg" }
			);
		}

		return ret;

	} catch (e: unknown) {
		reportError(new Error("Fail connectOrg", { cause: e }), { path: "connectOrg" });
		return e as AxiosError;
	}
}

let lastOpenWin: WindowProxy | null = null;
async function installNewApp(callbacks: {
	onFinish: (gitHubInstallationId: number | undefined) => void,
	onRequested: (setupAction: string) => void,
	onPopupBlocked: () => void
}): Promise<void> {

	const app = await Api.app.getAppNewInstallationUrl();

	if(lastOpenWin) {
		//do nothing, as there's already an win opened.
		return;
	}

	const newPopWin = popup(app.data.appInstallationUrl);
	if (newPopWin === null) {
		callbacks.onPopupBlocked();
		return;
	}

	const winInstall = lastOpenWin = newPopWin;

	const handler = async (event: MessageEvent) => {
		lastOpenWin = null;
		if (event.data?.type === "install-callback" && event.data?.gitHubInstallationId) {
			const id = parseInt(event.data?.gitHubInstallationId);
			if(!id) {
				reportError(
					{ message: "GitHub installation id is empty on finish OAuth flow" },
					{ path: "installNewApp" }
				);
			}
			callbacks.onFinish(isNaN(id) ? undefined : id);
		}
		if (event.data?.type === "install-requested" && event.data?.setupAction) {
			const setupAction = event.data?.setupAction;
			callbacks.onRequested(setupAction);
		}
	};
	window.addEventListener("message", handler);

	// Still need below interval for window close
	// As user might not finish the app install flow, there's no guarantee that above message
	// event will happen.
	const hdlWinInstall = setInterval(() => {
		if (winInstall?.closed) {
			try {
				lastOpenWin = null;
				setTimeout(() => window.removeEventListener("message", handler), 1000); //give time for above message handler to kick off
			} catch (e: unknown) {
				reportError(new Error("Fail remove listener", { cause: e }), { path: "installNewApp", reason: "Fail remove message listener" });
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
