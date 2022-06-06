$('.jiraSelectGitHubVersion__options__card').click(function (event) {
	event.preventDefault();
	const selectedCard = event.target.className;
	const selectedVersion = selectedCard.includes("cloud") ? "cloud" : "server";
	const className = `.jiraSelectGitHubVersion__options__card.${selectedVersion}`;

	if (selectedVersion === "cloud" && $(".jiraSelectGitHubVersion__options__card.server").hasClass("selected")) {
		$(".jiraSelectGitHubVersion__options__card.server").removeClass("selected");
	} else if (selectedVersion === "server" && $(".jiraSelectGitHubVersion__options__card.cloud").hasClass("selected")) {
		$(".jiraSelectGitHubVersion__options__card.cloud").removeClass("selected");
	}

	$(`${className}`).addClass("selected");
	$(".jiraSelectGitHubVersion__actionBtn").prop("disabled", false).attr("aria-disabled", "false").addClass("aui-button-primary");
})
