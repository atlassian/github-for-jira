import Api from "../api";
import { getJiraJWT } from "../utils";

export type UserContext = {
	tenantId: string;
	accountId: string;
	clientKey: string;
};

export const getUserContext = async (): Promise<UserContext | undefined> => {

	try {

		const jwtToken: string = await getJiraJWT();

		const parsedClaim = JSON.parse(atob(jwtToken.split(".")[1]));

		const { sub: accountId, iss: clientKey } = parsedClaim;

		const { data: { cloudId: tenantId } } = await Api.app.getJiraCloudId();

		return {
			tenantId,
			accountId,
			clientKey
		};

	} catch (e) {
		console.error("fail fetching user context", e);
		return undefined;
	}

};
