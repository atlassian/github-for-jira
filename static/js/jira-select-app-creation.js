$(".optionBtn").click(function (event) {
	event.preventDefault();
	if ($(".optionsCard.selected").data('type') === "manual") {
		AP.navigator.go(
			'addonmodule',
			{
				moduleKey: "github-manual-app-creation-page",
				// TODO: Need to fetch the gitHubServerAppId
				customData: { ghsaId: 1 }
			}
		);
	} else {
	//	TODO: Add action for Automatic App creation
	}
});

