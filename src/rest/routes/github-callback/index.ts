import { Request, Response } from "express";
import sanitize from "sanitize-html";
import { errorWrapper } from "../../helper";
import { InvalidArgumentError } from "config/errors";

export const OAuthCallbackHandler = errorWrapper("OAuthCallbackHandler", async function GitHubCallbackGet(req: Request, res: Response<string>) {

	const code = String(req.query.code || "");
	const state = String(req.query.state || "");

	if (!code) {
		req.log.warn("Missing code in query");
		throw new InvalidArgumentError("Missing code in query");
	}

	if (!state) {
		req.log.warn("Missing state in query");
		throw new InvalidArgumentError("Missing state in query");
	}

	/**
	 * A static page,
	 * which simply sends the tokens back to the parent window
	 * and then closes itself
	 */
	res.status(200).send(getPostMessageScript({ type: "oauth-callback", code: sanitize(code), state: sanitize(state) }));

});

export const OrgsInstalledHandler = errorWrapper("OrgsInstalledHandler", async function GitHubCallbackGet(req: Request, res: Response<string>) {
	const sanitizedGitHubInstallationId = sanitize(String(req.query.installation_id || ""));
	if (!sanitizedGitHubInstallationId) {
		throw new InvalidArgumentError("Missing installation_id");
	}
	res.status(200).send(getPostMessageScript({ type: "install-callback", gitHubInstallationId: sanitizedGitHubInstallationId }));
});

export const OrgsInstallRequestedHandler = errorWrapper("OrgsInstallRequestedHandler", async function GitHubCallbackGet(req: Request, res: Response<string>) {
	const sanitizedSetupAction = sanitize(String(req.query.setup_action || ""));
	if (!sanitizedSetupAction) {
		throw new InvalidArgumentError("Missing setup_action");
	}
	res.status(200).send(getPostMessageScript({ type: "install-requested", setupAction: sanitizedSetupAction }));
});

const getPostMessageScript = function(opts: Record<string, unknown>) {
	return `<html>
			<body></body>
			<script>
				window.opener.postMessage(${JSON.stringify({ ...opts })}, window.origin);
				window.close();
			</script>
		</html>
	`;
};
