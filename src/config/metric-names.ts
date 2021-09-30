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
	jobDuration: `${server}.queue.job-duration`,
}

export const metricHttpRequest = (metricName?: string) => {
	return {
		duration: `${server}.http.server.requests.duration`, //Duration of incoming HTTP requests
		executed: `${server}.http.server.requests`, //Count of executed incoming HTTP requests
		github: `${server}.http.request.github`, //Octokit requests execution time histogram
		jira: `${server}.http.request.jira`, //Jira requests execution time histogram
		install: `${server}.http.request.install`, //Count how many installation requests we received
		uninstall: `${server}.http.request.uninstall`, //Count how many uninstallation requests we received
		syncPullRequest: `${server}.http.request.sync-pull-request`, //Measures retrieval time from GitHub API
		hydroSubmission: `${server}.http.request.${metricName}`,
		requestStatusSync: `${server}.http.request.request-status-syncs`
	};
};

export const metricSyncStatus = {
	complete: `${server}.sync-status.complete`,
	failed: `${server}.sync-status.failed`,
	fullSyncDuration: `${server}.sync.full-sync.duration`, //Measures total time of full sync
};

export const metricTaskStatus = {
	complete: `${server}.task-status.complete`,
	failed: `${server}.task-status.failed`
};

export const metricWebhooks = {
	webhookEvent: `${server}.webhooks.webhook-events`,
	webhookProcessingTimes: `${server}.webhooks.processing-time.duration-ms`,
	webhookLatency: `${server}.webhooks.processing-time.latency`,
};

export const pageRendered = {
	gitHubInstallations: `${server}.rendering-github-installations-page`
};
