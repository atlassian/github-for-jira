import Api from "../../api";
import { AxiosError } from "axios";
import { reportError } from "../../utils";
import { DeferralRequestPayload } from "rest-interfaces";
async function extractFromRequestId(requestId: string): Promise<DeferralRequestPayload | AxiosError> {
	try {
		const response = await Api.deferral.parseDeferredRequestId(requestId);
		const ret = response.status === 200;
		if(!ret) {
			reportError(
				{ message: "Response status for parsing deferred request id is not 200", status: response.status },
				{ path: "parseDeferredRequestId" }
			);
		}

		return response.data;
	} catch (e: unknown) {
		reportError(new Error("Invalid Request id", { cause: e }), { path: "parseDeferredRequestId" });
		return e as AxiosError;
	}
}

async function connectOrgByDeferral(requestId: string): Promise<boolean | AxiosError> {
	try {
		const response = await Api.deferral.connectDeferredOrg(requestId);
		const ret = response.status === 200;
		if (!ret) {
			reportError(
				{ message: "Response status for connecting org is not 200", status: response.status },
				{ path: "connectOrgByDeferral" }
			);
		}

		return ret;
	} catch (e: unknown) {
		reportError(new Error("Couldn't connect org by deferral", { cause: e }), { path: "connectOrgByDeferral" });
		return e as AxiosError;
	}
}

export default {
	extractFromRequestId,
	connectOrgByDeferral
};
