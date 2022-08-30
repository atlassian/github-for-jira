// setup route middlewares
import cookieSession from "cookie-session";
import { createHashWithSharedSecret } from "utils/encryption";

const THIRTY_DAYS_MSEC = 30 * 24 * 60 * 60 * 1000;

// TODO: replace with encryption + Cryptor
export const cookieSessionMiddleware = cookieSession({
	keys: [createHashWithSharedSecret(process.env.STORAGE_SECRET), process.env.GITHUB_CLIENT_SECRET],
	maxAge: THIRTY_DAYS_MSEC,
	signed: true,
	sameSite: "none",
	secure: true,
	httpOnly: true
});
