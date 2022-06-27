/* globals $, AP */
$(".go-back").click(function(event) {
	event.preventDefault();

	AP.navigator.go('addonmodule', { moduleKey: "github-post-install-page" });
});
