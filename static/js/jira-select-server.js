$('.select-server').click(function (event) {
  event.preventDefault();

  AP.navigator.go("addonmodule", {
    moduleKey: "github-list-server-apps-page",
    customData: {
			connectConfigUuid: $(event.target).data("identifier"),
    	serverUrl: $(event.target).data("identifier") // TODO: remove when the descriptor is propagated everywhere, ~ in 1 month
    }
  })
});
