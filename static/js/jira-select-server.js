$('.select-server').click(function (event) {
  event.preventDefault();

  AP.navigator.go("addonmodule", {
    moduleKey: "github-list-server-apps-page",
    customData: { serverUrl: $(event.target).data("identifier") }
  })
});