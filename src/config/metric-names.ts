const frontend = "app.frontend";
const server = "app.server";

export const metricError = {
	expressRateLimited: `${server}.error.express-rate-limited`,
	githubErrorRendered: `${frontend}.error.github-error-rendered`,
	failedConnection: `${server}.error.failed-connection`,
	queueError: `${server}.error.queue-error`,
	queueFailed: `${server}.error.queue-failed`
};

export const queueMetrics = {
	active: `${server}.queue.active`,
	completed: `${server}.queue.completed`,
	failed: `${server}.queue.failed`,
	delayed: `${server}.queue.delayed`,
	waiting: `${server}.queue.waiting`,
	paused: `${server}.queue.paused`,
	repeatable: `${server}.queue.repeatable`,
}

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
	failed: `${server}.sync-status.failed`
};

export const metricWebhooks = {
	webhookEvent: `${server}.webhooks.webhook-events`,
	webhookProcessingTimes: `${server}.webhooks.processing-time.duration-ms`,
	webhookLatency: `${server}.webhooks.processing-time.latency`,
};

export const pageRendered = {
	gitHubInstallations: `${server}.rendering-github-installations-page`
};
