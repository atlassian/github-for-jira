import Api from "../../api";
import { AxiosError } from "axios";
import { reportError } from "../../utils";
import { GHSubscriptions } from "../../../../src/rest-interfaces";

async function getSubscriptions(): Promise<GHSubscriptions | AxiosError> {
	try {
		const response= await Api.subscriptions.getSubscriptions();
		const status = response.status === 200;
		if(!status) {
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
		const ret = response.status === 204;
		if(!ret) {
			reportError(
				{ message: "Response status for deleting subscription is not 204", status: response.status },
				{ path: "deleteSubscription" }
			);
		}

		return ret;
	} catch (e: unknown) {
		reportError(new Error("Unable to delete subscription", { cause: e }), { path: "deleteSubscription" });
		return e as AxiosError;
	}
}

export default {
	getSubscriptions,
	deleteSubscription,
};


