/* globals $, AP */
const params = new URLSearchParams(window.location.search.substring(1));
const jiraHost = params.get("xdm_e");

AJS.formValidation.register(['ghe-url'], (field) => {
	const inputURL = field.el.value;
	if (!inputURL.trim().length) {
		field.invalidate(AJS.format('This is a required field.'));
		$("#gheServerBtn").attr({ "aria-disabled": true, "disabled": true });
	} else {
		field.validate();
		$("#gheServerBtn").attr({ "aria-disabled": false, "disabled": false });
	}
});

const activeRequest = () => {
	$("#gheServerBtnText").hide();
	$("#gheServerBtnSpinner").show();
};

const requestFailed = () => {
	$("#gheServerBtnText").show();
	$("#gheServerBtnSpinner").hide();
};

const getGHEServerError = (error, url) => {
	let reason = '';
	if (error.reason) {
		reason = `<br />Reason: ${error.reason}.<br />`;
	}
	switch (error.code) {
		case "GHE_ERROR_INVALID_URL":
			return {
				title: "Invalid URL",
				message: 'The entered URL is not valid. ' +
					reason +
					'<a href="https://support.atlassian.com/jira-cloud-administration/docs/connect-a-github-enterprise-server-account-to-jira-software/#How-the-GitHub-for-Jira-app-fetches-data" target="_blank">' +
					'Learn more' +
					'</a>.',
			};
		case "GHE_ERROR_GITHUB_CLOUD_HOST":
			return {
				title: "GitHub Cloud site",
				message: `The entered URL is a GitHub Cloud site.`,
			};
		case "GHE_ERROR_CANNOT_CONNECT":
			return {
				title: "Connection failed",
				message: `We couldn't connect to <b>${url}</b>. ${reason}Please make sure GitHub for Jira can connect to it and try again. <a href="https://support.atlassian.com/jira-cloud-administration/docs/integrate-with-github/#How-the-GitHub-for-Jira-app-fetches-data" target="_blank">Learn more</a>`
			};
		default:
			return {
				title: "Something went wrong",
				message: `We ran into a hiccup while verifying your details. Please try again later. <br/> Error code: <b>${error.code}</b>. ${reason}`
			};
	}
}

const handleGheUrlRequestErrors = (err) => {
	requestFailed();
	const { title, message } = err;
	$(".jiraServerUrl__validationError").show();
	$(".errorMessageBox__title").empty().append(title);
	$(".errorMessageBox__message").empty().append(message);
}

const verifyGitHubServerUrl = (gheServerURL) => {
	const csrf = document.getElementById("_csrf").value

	AP.context.getToken(function(token) {
		$.post("/jira/connect/enterprise", {
				gheServerURL,
				_csrf: csrf,
				jwt: token,
				jiraHost
			},
			function(data) {
				if (data.success) {
					const pagePath = data.appExists
						? "github-list-server-apps-page"
						: "github-app-creation-page";
					const customData = data.appExists
						? {
							connectConfigUuid: data.connectConfigUuid,
							serverUrl: data.connectConfigUuid // TODO remove when the new descriptor is propagated everywhere (in 1 month?)
						}
						: {
							connectConfigUuid: data.connectConfigUuid,
							serverUrl: data.connectConfigUuid, // TODO remove when the new descriptor is propagated everywhere (in 1 month?)
							new: 1
						};
					AP.navigator.go(
						"addonmodule",
						{
							moduleKey: pagePath,
							customData
						}
					);
				} else {
					const errorMessage = getGHEServerError(data.errors[0], gheServerURL);
					handleGheUrlRequestErrors(errorMessage);
				}
			}
		).fail(function(xhr, status, error) {
			console.error("Error while calling backend", status, error);
			handleGheUrlRequestErrors(getGHEServerError({
				code: status,
				reason: xhr.responseText
			}, gheServerURL));
		});
	});
};

AJS.$("#jiraServerUrl__form").on("aui-valid-submit", event => {
	event.preventDefault();
	const gheServerURL = $("#gheServerURL").val().replace(/\/+$/, "");
	const installationId = $(event.currentTarget).data("installation-id");

	if ($("#gheServerBtnSpinner").is(":hidden")) {
		activeRequest();
		verifyGitHubServerUrl(gheServerURL, installationId);
	}
});
