$('.jiraSelectGitHubVersion__options__card').click(function (event) {
	event.preventDefault();
	const selectedCard = event.target.className;
	const selectedVersion = selectedCard.substring(selectedCard.indexOf(' ') + 1);
	const className = `.jiraSelectGitHubVersion__options__card.${selectedVersion}`;

	if (selectedVersion === "cloud") {
		$(".jiraSelectGitHubVersion__options__card.server").removeClass("selected");
	}

	if (selectedVersion === "server") {
		$(".jiraSelectGitHubVersion__options__card.cloud").removeClass("selected");
	}

	$(`${className}`).addClass("selected");
	$(".jiraSelectGitHubVersion__actionBtn").prop("disabled", false).attr("aria-disabled", "false").addClass("aui-button-primary");
})
