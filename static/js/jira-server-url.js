/* globals $, AP */
const params = new URLSearchParams(window.location.search.substring(1));
const jiraHost = params.get("xdm_e");
const GITHUB_CLOUD = ["github.com", "www.github.com"];

AJS.formValidation.register(['ghe-url'], (field) => {
	const inputURL = field.el.value;
	try {
		const { protocol, hostname } = new URL(inputURL);

		if (!/^https?:$/.test(protocol)) {
			// TODO: add URL for this
			field.invalidate(AJS.format('The entered URL is not valid. <a href="#">Learn more</a>.'));
		}
		else if (GITHUB_CLOUD.includes(hostname)) {
			field.invalidate(AJS.format('The entered URL is a GitHub Cloud site. <a href="/session/github/configuration&ghRedirect=to" target="_blank">Connect a GitHub Cloud site<a/>.'));
		} else {
			field.validate();
		}
	} catch (e) {
    if (!inputURL.trim().length) {
      field.invalidate(AJS.format('This is a required field.'));
    } else {
      field.invalidate(AJS.format('The entered URL is not valid. Learn more.'));
    }
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
}

const mapErrorCode = (errorCode) => {
	const errorMessage = gheServerUrlErrors[errorCode]
	handleGheUrlRequestErrors(errorMessage);
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
					mapErrorCode(data.errors[0].code);
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
});


AJS.$("#jiraServerUrl__form").on("aui-valid-submit", event => {
	event.preventDefault();
	const gheServerURL = $("#gheServerURL").val().replace(/\/+$/, "");
	const installationId = $(event.currentTarget).data("installation-id");

	activeRequest();
	verifyGitHubServerUrl(gheServerURL, installationId);
});
