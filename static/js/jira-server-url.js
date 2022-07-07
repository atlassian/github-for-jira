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
	errorCode: {
		GHE_ERROR_1: {
			title: "Invalid URL",
			message: "That URL doesn't look right. Please check and try again.",
		},
		"GHE_ERROR_2": {
			title: "We couldn't verify this URL",
			message: "Please make sure you've entered the correct URL and check that you've properly configured the hole in your firewall.",
		},
		GHE_ERROR_3: {
			title: "Request failed",
			message: "We weren't able to complete your request. Please try again."
		},
		GHE_ERROR_4: {
			title: "Something went wrong",
			message: "We ran into a hiccup while verifying your details. Please try again later."
		}
	}
};

const handleGheUrlRequestErrors = (err) => {
	requestFailed();
	const { title, message } = err;
	$(".jiraServerUrl__validationError").show();
	$(".errorMessageBox__title").empty().append(title);
	$(".errorMessageBox__message").empty().append(message);
	title === gheServerUrlErrors.errorCode.GHE_ERROR_2.title && $(".errorMessageBox__link").show();
}

const mapErrorCode = (errorCode) => gheServerUrlErrors.errorCode[errorCode];

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
					const pagePath = data.moduleKey;
					AP.navigator.go(
						"addonmodule",
						{
							moduleKey: pagePath
						}
					);
				} else {
					const { errorCode } = data;
					const errorMessage = mapErrorCode(errorCode);
					handleGheUrlRequestErrors(errorMessage);
				}
			},
			error: function(err) {
				const { errorCode } = JSON.parse(err.responseText);
				const errorMessage = mapErrorCode(errorCode);
				handleGheUrlRequestErrors(errorMessage);
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
