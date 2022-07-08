$(".optionBtn").click(function (event) {
	event.preventDefault();
	if ($(".optionsCard.selected").data('type') === "manual") {
		AP.navigator.go(
			'addonmodule',
			{
				moduleKey: "github-manual-app-creation-page"
			}
		);
	} else {
	//	TODO: Add action for Automatic App creation
	}
});

