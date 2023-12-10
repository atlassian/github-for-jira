import Api from "../../api";
import { AxiosError } from "axios";
import { reportError } from "../../utils";
import { GHSubscriptions } from "../../../../src/rest-interfaces";
import { RestSyncReqBody } from "~/src/rest-interfaces";

async function syncSubscription(subscriptionId:number, reqBody: RestSyncReqBody): Promise<void | AxiosError> {
	try {
		const response= await Api.subscriptions.syncSubscriptions(subscriptionId,reqBody);
		const isSuccessful = response.status === 202;
		if(!isSuccessful) {
			reportError(
				{ message: "Response status for backfilling subscriptions is not 202", status: response.status },
				{ path: "syncSubscription" }
			);
		}
	} catch (e: unknown) {
		reportError(new Error("Unable to backfill subscription", { cause: e }), { path: "syncSubscription" });
		return e as AxiosError;
	}
}

async function getSubscriptions(): Promise<GHSubscriptions | AxiosError> {
	try {
		const response= await Api.subscriptions.getSubscriptions();
		const isSuccessful = response.status === 200;
		if(!isSuccessful) {
			reportError(
				{ message: "Response status for getting subscriptions is not 204", status: response.status },
				{ path: "getSubscriptions" }
			);
		}

		return response.data;
	} catch (e: unknown) {
		reportError(new Error("Unable to delete subscription", { cause: e }), { path: "getSubscriptions" });
		return e as AxiosError;
	}
}

async function deleteSubscription(subscriptionId: number): Promise<boolean | AxiosError> {
	try {
		const response= await Api.subscriptions.deleteSubscription(subscriptionId);
		const isSuccessful = response.status === 204;
		if(!isSuccessful) {
			reportError(
				{ message: "Response status for deleting subscription is not 204", status: response.status },
				{ path: "deleteSubscription" }
			);
		}

		return isSuccessful;
	} catch (e: unknown) {
		reportError(new Error("Unable to delete subscription", { cause: e }), { path: "deleteSubscription" });
		return e as AxiosError;
	}
}

export default {
	getSubscriptions,
	deleteSubscription,
	syncSubscription
};


