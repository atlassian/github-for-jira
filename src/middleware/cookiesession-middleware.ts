// setup route middlewares
import cookieSession from "cookie-session";
import { envVars }  from "config/env";

export const cookieSessionMiddleware = cookieSession({
	keys: [envVars.GITHUB_CLIENT_SECRET],
	maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
	signed: true,
	sameSite: "none",
	secure: true,
	httpOnly: false
});
