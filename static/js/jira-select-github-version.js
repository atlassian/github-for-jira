$(".jiraSelectGitHubVersion__options__card").click(function (event) {
	event.preventDefault();
	const selectedVersion = $(event.target).data("type");

	$(".jiraSelectGitHubVersion__options__card").removeClass("selected");
	$(`.jiraSelectGitHubVersion__options__card.${selectedVersion}`).addClass("selected");
	$(".jiraSelectGitHubVersion__actionBtn").prop("disabled", false).attr("aria-disabled", "false").addClass("aui-button-primary");
});
