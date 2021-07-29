const frontend = "app.frontend";
const server = "app.server";

export const metricError = {
	expressRateLimited: `${server}.error.express-rate-limited`,
	githubErrorRendered: `${frontend}.error.github-error-rendered`
};

export const metricHttpRequest = (metricName?: string) => {
	return {
		github: `${server}.http.request.github`,
		jira: `${server}.http.request.jira`,
		install: `${server}.http.request.install`,
		uninstall: `${server}.http.request.uninstall`,
		fullSync: `${server}.http.request.full-sync`,
		syncPullRequest: `${server}.http.request.sync-pull-request`,
		hydroSubmission: `${server}.http.request.${metricName}`,
		jobDuration: `${server}.http.request.job-duration`,
		requestStatusSync: `${server}.http.request.request-status-syncs`
	};
};

export const metricSyncStatus = {
	complete: `${server}.sync-status.complete`,
	stalled: `${server}.sync-status.stalled`,
	failed: `${server}.sync-status.failed`
};

export const metricWebhooks = {
	webhookEvent: `${server}.webhooks.webhook-events`
};
