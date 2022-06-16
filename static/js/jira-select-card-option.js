$(".optionsCard").click(function (event) {
	event.preventDefault();
	$(".optionsCard").removeClass("selected");
	$(event.currentTarget).addClass("selected");
	$(".optionBtn").prop("disabled", false).attr("aria-disabled", "false").addClass("aui-button-primary");
});
