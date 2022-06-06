$('.jiraSelectGitHubVersion__options__card').click(function (event) {
	event.preventDefault();
	const selectedCard = event.target.className;
	const selectedVersion = selectedCard.includes("cloud") ? "cloud" : "server";
	const className = `.jiraSelectGitHubVersion__options__card.${selectedVersion}`;

	$(".jiraSelectGitHubVersion__options__card").removeClass("selected");
	$(`${className}`).addClass("selected");
	$(".jiraSelectGitHubVersion__actionBtn").prop("disabled", false).attr("aria-disabled", "false").addClass("aui-button-primary");
})
