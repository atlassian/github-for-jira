import Keygrip from "keygrip";
import * as cookie from "cookie";
import { Response } from "superagent";

export const generateSignedSessionCookieHeader = (fixture:unknown): string[] => {
	const cookie = generateSignedSessionCookie(fixture);
	return [
		`session=${cookie.session};session.sig=${cookie.sessionSig};`
	];
};


export const generateSignedSessionCookie = (fixture:unknown) => {
	const cookie = Buffer.from(JSON.stringify(fixture)).toString("base64");
	const keygrip = Keygrip([process.env.GITHUB_CLIENT_SECRET || ""]);
	return {
		session: cookie,
		sessionSig: keygrip.sign(`session=${cookie}`)
	};
};

export const parseCookiesAndSession = (response: Response): { cookies: any, session?: any } =>  {
	const parsedCookies = response.header["set-cookie"].reduce((acc, setCookieString) => {
		const parsed = cookie.parse(setCookieString);
		return Object.assign(acc, parsed);
	}, {});
	if (parsedCookies["session"]) {
		return {
			cookies: parsedCookies,
			session: JSON.parse(new Buffer(parsedCookies["session"], "base64").toString("ascii"))
		};
	}
	return { cookies: parsedCookies };
};

export const 	findOAuthStateInSession = (session: any) => Object.entries(session).find(keyValue =>
	keyValue[1] instanceof Object && keyValue[1]["postLoginRedirectUrl"]
)![1];

export const 	findOAuthStateKeyInSession = (session: any) => Object.entries(session).find(keyValue =>
	keyValue[1] instanceof Object && keyValue[1]["postLoginRedirectUrl"]
)![0];

