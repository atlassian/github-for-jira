/* globals $, AP */
const params = new URLSearchParams(window.location.search.substring(1));
const jiraHost = params.get("xdm_e");

function openChildWindow(url) {
	const child = window.open(url);
	const interval = setInterval(function () {
		if (child.closed) {
			clearInterval(interval);
			AP.navigator.reload();
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
	});

	$(".optionBtn").click(function (event) {
		event.preventDefault();

		if (selectedVersion === "cloud") {
			AP.context.getToken(function(token) {
				const child = openChildWindow("/session/github/configuration");
				child.window.jiraHost = jiraHost;
				child.window.jwt = token;
			});
		} else {
			AP.navigator.go(
				'addonmodule',
				{
					moduleKey: "github-server-url-page"
				}
			);
		}
	});
});
