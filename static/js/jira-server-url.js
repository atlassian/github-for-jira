/* globals $, AP */
const params = new URLSearchParams(window.location.search.substring(1));
const jiraHost = params.get("xdm_e");
const GITHUB_CLOUD = ["github.com", "www.github.com"];
const defaultError = {
	message: "The entered URL is not valid.",
	linkMessage: "Learn more",
	// TODO: add URL for this
	linkUrl: "#"
}
const cloudURLError = {
	message: "The entered URL is a GitHub Cloud site.",
	linkMessage: "Connect a GitHub Cloud site",
	linkUrl: "/session/github/configuration"
}

/**
 * Method that checks the validity of the passed URL
 *
 * @param {string} inputURL
 * @returns {boolean}
 */
const checkValidGHEUrl = inputURL => {
	try {
		const { protocol, hostname } = new URL(inputURL);

		if (!/^https?:$/.test(protocol)) {
			setErrorMessage(defaultError);
			return false;
		}

		if (GITHUB_CLOUD.includes(hostname)) {
			setErrorMessage(cloudURLError);
			return false;
		}

		return true;
	} catch (e) {
		setErrorMessage(defaultError);
		return false;
	}
};

/**
 * Sets an error message with the passed parameters
 *
 * @param {Object<defaultError | cloudURLError>} error
 */
const setErrorMessage = error => {
	$("#gheServerURLError").show();
	$("#gheServerURLError > span").html(error.message);
	$("#gheServerURLError > a").html(error.linkMessage).attr("href", error.linkUrl);
	$("#gheServerURL").addClass("has-error");
};

const hideErrorMessage = () => {
	$("#gheServerURLError").hide();
	$("#gheServerURL").removeClass("has-error");
};

const activeRequest = () => {
	$("#gheServerBtnText").hide();
	$("#gheServerBtnSpinner").show();
};

const requestFailed = () => {
	$("#gheServerBtnText").show();
	$("#gheServerBtnSpinner").hide();
};

const verifyGitHubServerUrl = (gheServerURL, installationId) => {
	const csrf = document.getElementById('_csrf').value;

	window.AP.context.getToken(function(token) {
		$.post("/jira/server-url", {
				gheServerURL,
				_csrf: csrf,
				jwt: token,
				jiraHost,
				installationId
			},
			function(data) {
				if (data.success) {
					const pagePath = data.moduleKey;
					AP.navigator.go(
						"addonmodule",
						{
							moduleKey: pagePath
						}
					);
				} else {
					console.error(`Failed to verify GHE server url. ${gheServerURL}`);
					requestFailed();
					// TODO - render error component
				}
			}
		);
	});
};

$("#gheServerURL").on("keyup", event => {
	const hasUrl = event.target.value.length > 0;
	$("#gheServerBtn").attr({
		"aria-disabled": !hasUrl,
		"disabled": !hasUrl
	});
	hideErrorMessage();
});

$("#gheServerBtn").on("click", event => {
	const btn = event.target;
	const gheServerURL = $("#gheServerURL").val().replace(/\/+$/, "");
	const isValid = checkValidGHEUrl(gheServerURL);
	const installationId = $(event.currentTarget).data("installation-id");

	$(btn).attr({
		"aria-disabled": !isValid,
		"disabled": !isValid
	});

	if (isValid) {
		hideErrorMessage();
		activeRequest();
		verifyGitHubServerUrl(gheServerURL, installationId);
	}
});
