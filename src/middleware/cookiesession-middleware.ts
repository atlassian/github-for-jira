// setup route middlewares
import cookieSession from "cookie-session";
import { envVars }  from "config/env";
import { createHashWithSharedSecret } from "utils/encryption";

const THIRTY_DAYS_MSEC = 30 * 24 * 60 * 60 * 1000;

// TODO: replace with encryption + Cryptor
export const cookieSessionMiddleware = cookieSession({
	keys: [createHashWithSharedSecret(envVars.STORAGE_SECRET), envVars.GITHUB_CLIENT_SECRET],
	maxAge: THIRTY_DAYS_MSEC,
	signed: true,
	sameSite: "none",
	secure: true,
	httpOnly: true
});
