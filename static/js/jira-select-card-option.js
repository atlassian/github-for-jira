$(".optionsCard").click(function (event) {
	event.preventDefault();
	const selectedVersion = $(event.target).data("type");

	$(".optionsCard").removeClass("selected");
	$(`.optionsCard.${selectedVersion}`).addClass("selected");
	$(".optionBtn").prop("disabled", false).attr("aria-disabled", "false").addClass("aui-button-primary");
});
