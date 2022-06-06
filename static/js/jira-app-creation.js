$('.jiraSelectAppCreation__options__card').click(function (event) {
	event.preventDefault();
	const selectedCard = event.target.className;
	const selectedOption = selectedCard.includes("automatic") ? "automatic" : "manual";
	const className = `.jiraSelectAppCreation__options__card.${selectedOption}`;

	$(".jiraSelectAppCreation__options__card").removeClass("selected");
	$(`${className}`).addClass("selected");
	$(".jiraAppCreation__actionBtn").prop("disabled", false).attr("aria-disabled", "false").addClass("aui-button-primary");
})
