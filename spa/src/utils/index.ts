import * as Sentry from "@sentry/react";
import { AxiosError } from "axios";
import { BackfillStatusResp, GHSubscriptions, SubscriptionBackfillState } from "../rest-interfaces";

export const getJiraJWT = (): Promise<string> => new Promise(resolve => {
	return AP.context.getToken((token: string) => {
		resolve(token);
	});
});

export function popup (url: string) {
	const openedPopup = window.open(url, "_blank");
	if (!openedPopup || openedPopup.closed || typeof openedPopup.closed === "undefined") {
		return null;
	}
	return openedPopup;
}

export function reportError(err: unknown, extra: {
	path: string,
	reason?: string
} & Record<string, unknown>) {
	try {

		const cause = (err as Record<string, unknown>).cause || {};
		delete (err as Record<string, unknown>).cause; //so that Sentry doesn"t group all axios error together

		Sentry.captureException(err, {
			extra: {
				...extra,
				...(err instanceof AxiosError ? extractKeyErrorInfo(err) : {}),
				cause: {
					...(cause instanceof AxiosError ? extractKeyErrorInfo(cause) : cause),
				}
			}
		});
	} catch (_) {
		//do nothing
	}
}

function extractKeyErrorInfo(e: AxiosError) {
	return {
		errMessage: e.message,
		errCode: e.code,
		errMethod: e.config?.method,
		errStatusCode: e.response?.status,
		errBody: e.response?.data
	};
}

export function openChildWindow(url: string) {
	const child: Window | null = window.open(url);
	const interval = setInterval(function () {
		if (child?.closed) {
			clearInterval(interval);
			AP.navigator.reload();
		}
	}, 100);
	return child;
}

export const getInProgressSubIds = (response: GHSubscriptions): Array<number> => {
	const successfulCloudConnections =
		response.ghCloudSubscriptions.successfulCloudConnections;
	const inProgressCloudConnections = successfulCloudConnections.filter(
		(connection) =>
			connection.syncStatus === "IN PROGRESS" ||
			connection.syncStatus === "PENDING"
	);
	const inProgressCloudSubIds = inProgressCloudConnections.map(
		(connection) => connection.subscriptionId
	);
	let inProgressGHESubIds: Array<number> = [];
	const ghEnterpriseServers = response.ghEnterpriseServers;
	for (const ghEnterpriseServer of ghEnterpriseServers) {
		const applications = ghEnterpriseServer.applications;
		for (const application of applications) {
			const successfulGHEConnections = application.successfulConnections;
			const inProgressGHEConnections = successfulGHEConnections.filter(
				(connection) =>
					connection.syncStatus === "IN PROGRESS" ||
					connection.syncStatus === "PENDING"
			);
			inProgressGHESubIds = inProgressGHEConnections.map(
				(connection) => connection.subscriptionId
			);
		}
	}
	return [...inProgressCloudSubIds, ...inProgressGHESubIds];
};

const getUpdatedCloudSubs = (
	currentSubs: GHSubscriptions,
	subscriptionId: number,
	subscription: SubscriptionBackfillState
) => {
	let matchedIndex;
	const successfulCloudConnections =
		currentSubs?.ghCloudSubscriptions.successfulCloudConnections;
	if (successfulCloudConnections) {
		matchedIndex = successfulCloudConnections.findIndex(
			(connection) => connection.subscriptionId === subscriptionId
		);
		successfulCloudConnections[matchedIndex] = {
			...successfulCloudConnections[matchedIndex],
			numberOfSyncedRepos: subscription.syncedRepos,
			syncStatus: subscription.syncStatus,
		};
		if (subscription.backfillSince) {
			successfulCloudConnections[matchedIndex]["backfillSince"] =
				subscription.backfillSince;
		}
		return {
			...currentSubs,
			ghCloudSubscriptions: {
				...currentSubs.ghCloudSubscriptions,
				successfulCloudConnections: successfulCloudConnections,
			},
		};
	}
};

const getUpdatedGHESubs = (
	currentSubs: GHSubscriptions,
	subscription: SubscriptionBackfillState
) => {
	const ghEnterpriseServers = currentSubs.ghEnterpriseServers;
	let ghEnterpriseServerIndex;
	let applicationIndex;
	for (const [
		ghEnterpriseServerI,
		ghEnterpriseServer,
	] of ghEnterpriseServers.entries()) {
		const applications = ghEnterpriseServer.applications;

		for (const [appIndex, app] of applications.entries()) {
			if (app.id === subscription.gitHubAppId) {
				ghEnterpriseServerIndex = ghEnterpriseServerI;
				applicationIndex = appIndex;
				break;
			}
		}
	}
	if (
		typeof ghEnterpriseServerIndex === "number" &&
		!isNaN(ghEnterpriseServerIndex) &&
		typeof applicationIndex === "number" &&
		!isNaN(applicationIndex)
	) {
		const newGHEnterpriseServers = ghEnterpriseServers;
		const apps = ghEnterpriseServers[ghEnterpriseServerIndex].applications;
		const newApps = [...apps];

		if (subscription.gitHubAppId) {
			const successfulConnections =
				newApps[applicationIndex]?.successfulConnections;
			const newSuccessfulConnections = successfulConnections.map(
				(connection) => {
					if (connection.subscriptionId === subscription.id) {
						const result = {
							...connection,
							syncStatus: subscription.syncStatus,
							numberOfSyncedRepos: subscription.syncedRepos,

						};
						if (subscription.backfillSince) {
							result["backfillSince"] =
								subscription.backfillSince;
						}
						return result;
					}
					return connection;
				}
			);

			newApps[applicationIndex] = {
				...newApps[applicationIndex],
				successfulConnections: [...newSuccessfulConnections],
			};
		}

		newGHEnterpriseServers[ghEnterpriseServerIndex] = {
			...ghEnterpriseServers[ghEnterpriseServerIndex],
			applications: newApps,
		};
		const result = {
			...currentSubs,
			ghEnterpriseServers: newGHEnterpriseServers,
		};
		return result;
	}
};

export const getUpdatedSubscriptions = (
	response: BackfillStatusResp,
	subscriptions: GHSubscriptions
): GHSubscriptions | undefined => {
	const currentSubs = subscriptions;
	let newSubs;
	const subscriptionIds = response.subscriptionIds || [];
	if (currentSubs) {
		for (const subscriptionId of subscriptionIds) {
			const subscriptions = response.subscriptions;
			const subscription = subscriptions[subscriptionId];
			if (!subscription.gitHubAppId) {
				newSubs = getUpdatedCloudSubs(
					currentSubs,
					subscriptionId,
					subscription
				);
			} else {
				newSubs = getUpdatedGHESubs(currentSubs, subscription);
			}
		}
		return newSubs;
	}
};
