import OctokitError from "../backend/models/octokit-error";
import statsd from "./statsd";
import { extractPath } from "../backend/jira/client/axios";
import { GitHubAPI } from "probot";
import { metricHttpRequest } from "./metric-names";

const instrumentRequests = (octokit: GitHubAPI) => {
	octokit.hook.wrap("request", async (request, options) => {
		const requestStart = Date.now();
		let responseStatus = null;

		try {
			const response = await request(options);
			responseStatus = response.status;

			return response;
		} catch (error) {
			if (error.responseCode) {
				responseStatus = error.responseCode;
			}

			throw error;
		} finally {
			const elapsed = Date.now() - requestStart;
			const tags = {
				path: extractPath(options.url),
				method: options.method,
				status: responseStatus
			};

			statsd.histogram(metricHttpRequest().github, elapsed, tags);
		}
	});
};

/*
 * Customize an Octokit instance behavior.
 *
 * This acts like an Octokit plugin but works on Octokit instances.
 * (Because Probot instantiates the Octokit client for us, we can't use plugins.)
 */
export default (octokit: GitHubAPI): GitHubAPI => {

	OctokitError.wrapRequestErrors(octokit);
	instrumentRequests(octokit);
	return octokit;
};
