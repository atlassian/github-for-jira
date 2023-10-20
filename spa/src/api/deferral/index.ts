import { DeferralRequestPayload, DeferredInstallationUrlParams, GetDeferredInstallationUrl } from "rest-interfaces";
import { axiosRest, axiosRestWithNoJwt, axiosRestWithNoJwtButWithGitHubToken } from "../axiosInstance";

export default {
	parseDeferredRequestId: (requestId: string) => axiosRestWithNoJwt.get<DeferralRequestPayload>(`/rest/app/cloud/deferred/parse/${requestId}`),
	getDeferredInstallationUrl: (params: DeferredInstallationUrlParams) =>
		axiosRest.get<GetDeferredInstallationUrl>("/rest/app/cloud/deferred/installation-url", { params }),
	checkAndConnect: (requestId: string) => axiosRestWithNoJwtButWithGitHubToken.post(`/rest/app/cloud/deferred/connect/${requestId}`)
};

