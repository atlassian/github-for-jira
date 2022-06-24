import { Builder as HttpClient } from "httplease/lib/builder";

const hostUrl = "https://rachelle-local.public.atlastunnel.com";

export async function deleteDevInfoDataByInstallationId(
	installationId: string
) {
	const httpClient = new HttpClient()
		.withBaseUrl(hostUrl)
		.withExpectStatus([200])
		.withBufferBodyResponseHandler()
		.withTimeout(10000)
		.withAgentOptions({ keepAlive: true });

	const path = `/api/deleteInstallation/${installationId}/${encodeURIComponent(
		"https://rachellerathbonee2e.atlassian.net"
	)}`;
	console.log(`Calling ${hostUrl}${path}`);

	return githubNock
		.delete(path)
		.matchHeader("Authorization", /^Bearer .+$/)
		.reply(200)

	// return httpClient
	// 	.withPath(path)
	// 	.withMethodDelete()
	// 	.withDiscardBodyResponseHandler()
	// 	.withHeaders({
	// 		Authorization: `Bearer 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`,
	// 	})
	// 	.send()
	// 	.catch((err) => {
	// 		if (err.response.statusCode === 401) {
	// 			console.error(
	// 				`calling DELETE /api/deleteInstallation returned 401. Make sure the fusion-arc-bot belongs to the Fusion Arc organisation and has admin permissions.`
	// 			);
	// 		}
	//
	// 		console.error('Failed to delete dev info data:', err);
	// 		throw err;
	// 	});
}
