import axios from "axios";

const CONNECT_INSTALL_KEYS_CDN_URL =
	"https://connect-install-keys.atlassian.com";
const CONNECT_INSTALL_KEYS_CDN_URL_STAGING =
	"https://cs-migrations--cdn.us-west-1.staging.public.atl-paas.net";


/**
 * Queries the public key for the specified keyId
 * @param keyId
 */
const queryAtlassianConnectPublicKey = async (keyId: string, isStagingTenant: boolean): Promise<string> => {

	const keyServerUrl = !isStagingTenant
		? CONNECT_INSTALL_KEYS_CDN_URL
		: CONNECT_INSTALL_KEYS_CDN_URL_STAGING;

	const result = await axios.get(`${keyServerUrl}/${keyId}`, {
		timeout: 5000
	})

	if (result.status !== 200) {
		throw new Error(`Unable to get public key for keyId ${keyId}`)
	}

	return result.data
}

export default queryAtlassianConnectPublicKey
