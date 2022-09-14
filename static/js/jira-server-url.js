/* globals $, AP */
const params = new URLSearchParams(window.location.search.substring(1));
const jiraHost = params.get("xdm_e");
const GITHUB_CLOUD = ["github.com", "www.github.com"];

const validateUrl = url => {
	const pattern = /^((?:http:\/\/)|(?:https:\/\/))(www.)?((?:[a-zA-Z0-9]+\.[a-z]{3})|(?:\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}))([/a-zA-Z0-9.]*)$/gm;
	return url.match(pattern);
}

AJS.formValidation.register(['ghe-url'], (field) => {
	const inputURL = field.el.value;
	try {
		const { hostname } = new URL(inputURL);

		if (!validateUrl(inputURL)) {
			field.invalidate(AJS.format(
				'The entered URL is not valid. ' +
				'<a href="https://support.atlassian.com/jira-cloud-administration/docs/connect-a-github-enterprise-server-account-to-jira-software/#How-the-GitHub-for-Jira-app-fetches-data" target="_blank">' +
				'Learn more' +
				'</a>.'
			));
			$("#gheServerBtn").attr({ "aria-disabled": true, "disabled": true });
		}
		else if (GITHUB_CLOUD.includes(hostname)) {
			field.invalidate(AJS.format('The entered URL is a GitHub Cloud site. <a href="/session/github/configuration&ghRedirect=to" target="_blank">Connect a GitHub Cloud site<a/>.'));
			$("#gheServerBtn").attr({ "aria-disabled": true, "disabled": true });
		} else {
			field.validate();
			$("#gheServerBtn").attr({ "aria-disabled": false, "disabled": false });
		}
	} catch (e) {
    if (!inputURL.trim().length) {
      field.invalidate(AJS.format('This is a required field.'));
    } else {
      field.invalidate(AJS.format('The entered URL is not valid.'));
    }
		$("#gheServerBtn").attr({ "aria-disabled": true, "disabled": true });
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

const getGHEServerError = (code, url) => {
	switch (code) {
		case "GHE_ERROR_INVALID_URL":
			return {
				title: "Invalid URL",
				message: "<b>${url}</b> doesn't look right. Please check and try again.",
			};
		case "GHE_ERROR_ENOTFOUND":
			return {
				title: `We couldn't verify ${url}`,
				message: "Please make sure you've entered the correct URL and check that you've properly configured the hole in your firewall.",
			};
		case "GHE_SERVER_BAD_GATEWAY":
			return {
				title: "Bad Gateway",
				message: "We weren't able to complete your request. Please try again."
			};
		case "GHE_ERROR_CONNECTION_TIMED_OUT":
			return {
				title: "Connection timed out",
				message: `We couldn't connect to <b>${url}</b>. Please make sure GitHub for Jira can connect to it and try again. <a href="https://support.atlassian.com/jira-cloud-administration/docs/integrate-with-github/#How-the-GitHub-for-Jira-app-fetches-data" target="_blank">Learn more</a>`
			};
		default:
			return {
				title: "Something went wrong",
				message: `We ran into a hiccup while verifying your details. Please try again later. <br/> Status code: <b>${code}</b>`
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
					const pagePath = data.appExists ? "github-list-server-apps-page" : "github-app-creation-page";
					const customData = data.appExists ?  { serverUrl: gheServerURL } : { serverUrl: gheServerURL, new: 1 };
					AP.navigator.go(
						"addonmodule",
						{
							moduleKey: pagePath,
							customData
						}
					);
				} else {
					const errorMessage = getGHEServerError(data.errors[0].code, gheServerURL);
					handleGheUrlRequestErrors(errorMessage);
				}
			}
		);
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
