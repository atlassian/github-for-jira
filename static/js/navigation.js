/* globals $, AP */
$(".go-back").click(function(event) {
	event.preventDefault();
	const previousPagePath = $(event.target).data("previous-page-path");

	console.log(previousPagePath);
	// TODO - pass the module key in
	AP.navigator.go('addonmodule', { moduleKey: "github-post-install-page" });
});
