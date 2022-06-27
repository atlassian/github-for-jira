/* globals $, AP */
$(".go-back").click(function(event) {
	event.preventDefault();

	// TODO - pass the module key in
	AP.navigator.go('addonmodule', { moduleKey: "github-post-install-page" });
});
