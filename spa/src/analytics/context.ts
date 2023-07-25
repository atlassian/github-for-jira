import Api from "../api";

export type UserContext = {
	tenantId: string;
	accountId: string;
	clientKey: string;
};

export const getUserContext = async (): Promise<UserContext | undefined> => {

	try {

		const jwtToken: string = await new Promise((res) => {
			AP.context.getToken((t: string) => { res(t); });
		});

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
