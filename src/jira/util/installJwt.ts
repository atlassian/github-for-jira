import {decodeAsymmetric, getAlgorithm, getKeyId} from "atlassian-jwt";
import {NextFunction, Request, Response} from "express";
import axios, {AxiosInstance} from "axios";
import {extractJwtFromRequest, TokenType, verifyJwtClaimsAndSetResponseCodeOnError} from "./jwt";
import _ from "lodash";
import envVars from "../../config/env";

const BASE_URL = envVars.APP_URL

const ALLOWED_BASE_URLS = [BASE_URL]

const createAxiosInstance = (baseUrl: string): AxiosInstance => {
	return axios.create({
		baseURL: baseUrl,
		timeout: +process.env.JIRA_TIMEOUT || 20000
	});
};

const CONNECT_INSTALL_KEYS_CDN_URL =
	"https://connect-install-keys.atlassian.com";


async function getKey(keyId) {
	const client = createAxiosInstance(CONNECT_INSTALL_KEYS_CDN_URL)

	const result = await client.get('/:key_id', {
		urlParams: {
			key_id: keyId
		}
	})

	if (result.status !== 200) {
		throw new Error(`Unable to get public key for keyId ${keyId}`)
	}

	return result.data
}

async function decodeAsymmetricToken(token, publicKey, noVerify) {
	return decodeAsymmetric(
		token,
		publicKey,
		getAlgorithm(token),
		noVerify
	);
}

function sendError(res: Response, code: number, msg: string) {
	res.status(code).json({
		message: msg
	});
}

const verifyAsymmetricJwtToken = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const token = extractJwtFromRequest(req);
		if (!token) {
			sendError(res, 401, "Unauthorized")
			return;
		}
		req.log.info("Got installation request with JWT token %s", token)

		const publicKey = await getKey(getKeyId(token));

		let unverifiedClaims: any = undefined
		unverifiedClaims = decodeAsymmetricToken(token, publicKey, true)

		const issuer = unverifiedClaims.iss;
		if (!issuer) {
			sendError(res, 401, "JWT claim did not contain the issuer (iss) claim");
			return;
		}

		if (_.isEmpty(unverifiedClaims.aud) ||
			!unverifiedClaims.aud[0] ||
			!_.includes(ALLOWED_BASE_URLS, unverifiedClaims.aud[0].replace(/\/$/, ""))) {

			sendError(res, 401, "WT claim did not contain the correct audience (aud) claim")
			return;
		}

		const verifiedClaims = decodeAsymmetricToken(token, publicKey, false)

		if (verifyJwtClaimsAndSetResponseCodeOnError(verifiedClaims, TokenType.normal, req, res)) {
			next()
		}
	} catch (e) {
		req.log.warn(e, "Error while validating JWT token")
		sendError(res, 401, "Unauthorized")
	}
}

export default verifyAsymmetricJwtToken
