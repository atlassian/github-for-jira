/* globals $, AP */
const params = new URLSearchParams(window.location.search.substring(1));
const jiraHost = params.get("xdm_e");

function openChildWindow(url) {
	const child = window.open(url);
	const interval = setInterval(function () {
		if (child.closed) {
			clearInterval(interval);
			if (Boolean($("#redirectToGitHubConfigPage").val())) {
				AP.navigator.go(
					'addonmodule',
					{
						moduleKey: "github-post-install-page"
					}
				);
			} else {
				AP.navigator.reload();
			}
		}
	}, 1000);

	return child;
}

$(".optionBtn").click(function (event) {
	event.preventDefault();

	if ($(".optionsCard.selected").data('type') === "cloud") {
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

