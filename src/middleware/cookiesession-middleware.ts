// setup route middlewares
import cookieSession from "cookie-session";
import { envVars }  from "config/env";
import { createHashWithSharedSecret } from "utils/encryption";

const THIRTY_DAYS_MSEC = 30 * 24 * 60 * 60 * 1000;

const middleware = cookieSession({
	keys: [createHashWithSharedSecret(envVars.STORAGE_SECRET), envVars.GITHUB_CLIENT_SECRET],
	maxAge: THIRTY_DAYS_MSEC,
	signed: true,
	sameSite: "none",
	secure: true,
	httpOnly: false
});

// TODO: replace with encryption + Cryptor
export const cookieSessionMiddleware = (req, resp, next) => {
	return middleware(req, resp, () => {
		if (req.session.encryptedData) {
			req.session = JSON.parse(req.session.encryptedData.substring("blah".length));
		}
		try {
			next();
		} finally {
			if (req.session) {
				const session = req.session;
				req.session = {
					encryptedData: "blah" + JSON.stringify(session)
				};
			}
		}
	});
};
