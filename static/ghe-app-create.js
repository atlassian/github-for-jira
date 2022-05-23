function loadManifestFile() {
	const input = document.getElementById("manifest")
	input.value = JSON.stringify({
		"name": "ghe-app-for-jira",
		"url": "https://www.example.com",
		"hook_attributes": {
			"url": "https://example.com/github/events",
		},
		"redirect_url": "http://localhost:8080/ghe-app-install/123456abcde",
		"public": true,
		"default_permissions": {
			"issues": "write",
			"checks": "write",
			"contents":"write"
		},
		"default_events": [
			"issues",
			"issue_comment",
			"check_suite",
			"check_run",
			"repository"
		]
	}, null, '\t');
}
loadManifestFile();