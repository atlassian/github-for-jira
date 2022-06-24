// setup route middlewares
import cookieSession from "cookie-session";
import { envVars }  from "config/env";
import { createHashWithSharedSecret } from "utils/encryption";
import EncryptedSession from "utils/encrypted-session";
import {CryptorHttpClient} from "utils/cryptor-http-client";

const THIRTY_DAYS_MSEC = 30 * 24 * 60 * 60 * 1000;

// TODO: replace with encryption + Cryptor
const cookieSessionMiddleware = cookieSession({
	keys: [createHashWithSharedSecret(envVars.STORAGE_SECRET), envVars.GITHUB_CLIENT_SECRET],
	maxAge: THIRTY_DAYS_MSEC,
	signed: true,
	sameSite: "none",
	secure: true,
	httpOnly: false
});

export (req, res, next) => {
	return cookieSessionMiddleware(req, res, () => {
		res.local.encryptedSession = new EncryptedSession(new CryptorHttpClient(), req.session)
		next();
	})
}
