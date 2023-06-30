/* globals $, AP */
const params = new URLSearchParams(window.location.search.substring(1));
const jiraHost = params.get("xdm_e");

function openChildWindow(url) {
	const child = window.open(url);
	const interval = setInterval(function () {
		if (child.closed) {
			clearInterval(interval);
			AP.navigator.go(
				'addonmodule',
				{
					moduleKey: "github-post-install-page"
				}
			);
		}
	}, 1000);

	return child;
}

$(document).ready(function() {
	let selectedVersion;

	$(".optionsCard").click(function (event) {
		event.preventDefault();
		const currentTarget = $(event.currentTarget);
		$(".optionsCard").removeClass("selected");
		currentTarget.addClass("selected");
		$(".optionBtn").prop("disabled", false).attr("aria-disabled", "false").addClass("aui-button-primary");

		selectedVersion = currentTarget.data('type');
		$(".jiraAppCreation__versionDisclaimer__prompt").css("visibility", selectedVersion === "manual" ? "hidden" : "visible");
	});

	$(".jiraSelectGitHubProduct__actionBtn").click(function (event) {
		event.preventDefault();

		if (selectedVersion === "cloud") {
			AP.context.getToken(function(token) {
				console.log("token???", token);
				const child = openChildWindow("/session/github/configuration?resetSession=true");
				child.window.jwt = token;
			});
		} else if(selectedVersion === "server"){
			AP.navigator.go(
				'addonmodule',
				{
					moduleKey: "github-server-url-page"
				}
			);
		}
	});

	$(".jiraAppCreation__actionBtn").click(function (event) {
		event.preventDefault();

		if (selectedVersion === "manual") {
			AP.navigator.go(
				'addonmodule',
				{
					moduleKey: "github-manual-app-page",
					customData: {
						connectConfigUuid: $("#connectConfigUuid").val(),
						serverUrl: $("#connectConfigUuid").val() // TODO: remove when the descriptor changes are propagated everywhere, in 1 month maybe?
					}
				}
			);
		} else {
			AP.context.getToken(function(token) {
				const child = openChildWindow("/session/github/manifest/" + $("#connectConfigUuid").val());
				child.window.jwt = token;
			});
		}
	});
});
