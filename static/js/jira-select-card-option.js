function getVersion(selectedVersion) {
	console.log(selectedVersion);
}

$(".optionsCard").click(function (event) {
	event.preventDefault();
	$(".optionsCard").removeClass("selected");
	$(event.currentTarget).addClass("selected");
	getVersion(event.currentTarget);
	$(".optionBtn").prop("disabled", false).attr("aria-disabled", "false").addClass("aui-button-primary");
});
