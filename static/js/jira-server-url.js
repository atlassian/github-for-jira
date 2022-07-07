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

const gheServerUrlErrors = {
	GHE_ERROR_INVALID_URL: {
		title: "Invalid URL",
		message: "That URL doesn't look right. Please check and try again.",
	},
	GHE_ERROR_ENOTFOUND: {
		title: "We couldn't verify this URL",
		message: "Please make sure you've entered the correct URL and check that you've properly configured the hole in your firewall.",
	},
	GHE_SERVER_BAD_GATEWAY: {
		title: "Something went wrong",
		message: "We weren't able to complete your request. Please try again."
	},
	GHE_ERROR_DEFAULT: {
		title: "Something went wrong",
		message: "We ran into a hiccup while verifying your details. Please try again later."
	}
};

const handleGheUrlRequestErrors = (err) => {
	requestFailed();
	const { title, message } = err;
	$(".jiraServerUrl__validationError").show();
	$(".errorMessageBox__title").empty().append(title);
	$(".errorMessageBox__message").empty().append(message);
	title === gheServerUrlErrors.GHE_ERROR_ENOTFOUND.title && $(".errorMessageBox__link").show();
}

const mapErrorCode = (errorCode) => {
	const errorMessage = gheServerUrlErrors[errorCode]
	handleGheUrlRequestErrors(errorMessage);
}


const verifyGitHubServerUrl = (gheServerURL, installationId) => {
	const csrf = document.getElementById("_csrf").value

	AP.context.getToken(function(token) {
		$.ajax({
			type: "POST",
			url: "/jira/server-url",
			data: {
				gheServerURL,
				_csrf: csrf,
				jwt: token,
				jiraHost,
				installationId
			},
			success: function(data) {
				if (data.success) {
					const pagePath = data.appExists ? "github-list-apps-page" : "github-app-creation-page";
					AP.navigator.go(
						"addonmodule",
						{
							moduleKey: pagePath
						}
					);
				} else {
					mapErrorCode(data.errorCode);
				}
			},
			error: function(err) {
				mapErrorCode(err.responseJSON.errorCode);
			}
		});
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
