import Keygrip from "keygrip";

export const generateSignedSessionCookieHeader = (fixture:unknown): string[] => {
	const cookie = Buffer.from(JSON.stringify(fixture)).toString("base64");
	const keygrip = Keygrip([process.env.GITHUB_CLIENT_SECRET || ""]);
	return [
		`session=${cookie};session.sig=${keygrip.sign(`session=${cookie}`)};`
	];
};
