export type CodeScanningAlertResponseItem = {
	number: number;
	created_at: string;
	updated_at: string;
	url: string;
	html_url: string;
	instances_url: string;
	state: "open" | "dismissed" | "fixed";
	fixed_at: string;
	dismissed_at: string;
	dismissed_reason: null | "false positive" | "won't fix" | "used in tests";
	dismissed_comment: string;
	rule: CodeScanningAlertResponseItemRule;
	tool: CodeScanningAlertResponseItemTool;
	most_recent_instance: CodeScanningAlertResponseItemMostRecentInstance;
};

type CodeScanningAlertResponseItemRule = {
	name: string;
	description: string;
	full_description: string;
	id: string | null;
	tags: string[] | null;
	severity: "none" | "note" | "warning" | "error" | null;
	security_severity_level: "low" | "medium" | "high" | "critical" | null;
	help: string | null;
	help_uri: string | null;
};

type CodeScanningAlertResponseItemTool = {
	name: string;
	version: string | null;
	guid: string | null;
}

type CodeScanningAlertResponseItemMostRecentInstance = {
	ref: string;
	environment: string;
	category: string;
	state: string;
	commit_sha: string;
	html_url: string;
}
