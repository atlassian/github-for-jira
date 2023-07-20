import { getDependabotAlerts } from "~/src/github/client/github-queries";

export const dependabotAlertsNoLastCursor = (variables?: Record<string, unknown>) => ({
	query: getDependabotAlerts,
	variables: {
		owner: "integrations",
		repo: "test-repo-name",
		per_page: 20,
		...variables
	}
});
