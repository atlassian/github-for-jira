import axios from "axios";

const CONNECT_INSTALL_KEYS_CDN_URL =
	"https://connect-install-keys.atlassian.com";

/**
 * Queries the public key for the specified keyId
 * @param keyId
 */
const queryAtlassianConnectPublicKey = async (keyId) => {

	const result = await axios.get(`${CONNECT_INSTALL_KEYS_CDN_URL}/${keyId}`, {
		timeout: 5000
	})

	if (result.status !== 200) {
		throw new Error(`Unable to get public key for keyId ${keyId}`)
	}

	return result.data
}

export default queryAtlassianConnectPublicKey
