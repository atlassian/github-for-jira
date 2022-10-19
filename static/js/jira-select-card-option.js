/* globals $, AP */
const params = new URLSearchParams(window.location.search.substring(1));
const jiraHost = params.get("xdm_e");
const gitHubServerBaseUrl = $("#baseUrl").val();
const issueKey = params.get("issueKey");
const issueSummary = params.get("issueSummary");

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

const goToCreateBranch = (url) => {
	AP.context.getToken(token => {
		const child = window.open(url);
		child.window.jiraHost = jiraHost;
		child.window.jwt = token;
		if (isAutoRedirect()) {
			const childWindowTimer = setInterval(() => {
				if (child.closed) {
					AP.navigator.go("issue", { issueKey: params.get("issueKey") });
					clearInterval(childWindowTimer);
				}
			}, 500);
		}
	});
};

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
				const child = openChildWindow("/session/github/configuration");
				child.window.jiraHost = jiraHost;
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
					customData: { serverUrl: gitHubServerBaseUrl }
				}
			);
		} else {
			AP.context.getToken(function(token) {
				const child = openChildWindow("/session?ghRedirect=to&autoApp=1&baseUrl=" + gitHubServerBaseUrl);
				child.window.jiraHost = jiraHost;
				child.window.jwt = token;
			});
		}
	});

	$(".gitHubCreateBranchOptions__actionBtn").click(function (event) {
		event.preventDefault();
		const uuid = $("#ghServers").select2("val");

		if (selectedVersion === "cloud") {
			goToCreateBranch(`session/github/create-branch?issueKey=${issueKey}&issueSummary=${issueSummary}`);
		} else {
			goToCreateBranch(`session/github/${uuid}/create-branch?issueKey=${issueKey}&issueSummary=${issueSummary}&ghRedirect=to`);
		}
	});
});


