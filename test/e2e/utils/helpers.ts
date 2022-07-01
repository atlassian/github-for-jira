import { githubContext, hostUrl } from "test/e2e/setup";

export const deleteDevInfoDataByInstallationId = async (installationId: string) => {
	// const httpClient =
	// 	.withBaseUrl(hostUrl)
	// 	.withExpectStatus([200])
	// 	.withBufferBodyResponseHandler()
	// 	.withTimeout(10000)
	// 	.withAgentOptions({ keepAlive: true });

	const path = `/api/deleteInstallation/${installationId}/${encodeURIComponent("https://rachellerathbonee2e.atlassian.net")}`;
	console.log(`Calling ${hostUrl}${path}`);

	/*return githubNock
		.delete(path)
		.matchHeader("Authorization", /^Bearer .+$/)
		.reply(200);*/

	return await githubContext.post(path, {
		data: {
			title: "[Feature] request 1"
		}
	});
/*
	return httpClient
		.withPath(path)
		.withMethodDelete()
		.withDiscardBodyResponseHandler()
		.withHeaders({
			Authorization: `Bearer <halp>`
		})
		.send()
		.catch((err) => {
			if (err.response.statusCode === 401) {
				console.error(
					`calling DELETE /api/deleteInstallation returned 401.`
				);
			}

			console.error("Failed to delete dev info data:", err);
			throw err;
		});*/
};
