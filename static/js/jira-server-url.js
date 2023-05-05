/* globals $, AP */
const params = new URLSearchParams(window.location.search.substring(1));
const jiraHost = params.get("xdm_e");

const gheServerURLElt = document.getElementById("gheServerURL");
const gheApiKeyHeaderElt = document.getElementById("gheApiKeyHeader");
const gheApiKeyValueElt = document.getElementById("gheApiKeyValue");

function syncGheServerBtn() {
	if (
		gheServerURLElt.getAttribute("data-aui-validation-state") === "invalid" ||
		(gheApiKeyHeaderElt && gheApiKeyHeaderElt.getAttribute("data-aui-validation-state") === "invalid") ||
		(gheApiKeyValueElt && gheApiKeyValueElt.getAttribute("data-aui-validation-state") === "invalid")
	) {
		$("#gheServerBtn").attr({ "aria-disabled": true, "disabled": true });
	} else {
		$("#gheServerBtn").attr({ "aria-disabled": false, "disabled": false });
	}
}

AJS.formValidation.register(['ghe-url'], (field) => {
	const inputURL = field.el.value;
	if (!inputURL.trim().length) {
		field.invalidate(AJS.format('This is a required field.'));
		syncGheServerBtn();
	} else {
		field.validate();
		syncGheServerBtn();
	}
});

AJS.formValidation.register(['api-key-header'], (field) => {
	const inputStr = field.el.value;
	if (inputStr.trim().length) {
		if (inputStr.trim().length > 1024) {
			field.invalidate(AJS.format('Max length is 1,024 characters.'));
		} else if (window.knownHttpHeadersLowerCase.indexOf(inputStr.trim().toLowerCase()) >= 0) {
			field.invalidate(AJS.format(inputStr.trim() + ' is a reserved string and cannot be used.'));
		} else {
			field.validate();
		}
	} else {
		field.validate();
	}
	AJS.formValidation.validate(gheApiKeyValueElt);
});

AJS.formValidation.register(['api-key-header-value'], (field) => {
	const inputStr = field.el.value;
	if (gheApiKeyHeaderElt.value.trim().length === 0) {
		if (inputStr.trim().length === 0) {
			field.validate();
		} else {
			field.invalidate(AJS.format('Cannot be used without HTTP header name.'));
		}
	} else if (inputStr.trim().length === 0) {
		field.invalidate(AJS.format('Cannot be empty.'));
	} else if (inputStr.trim().length > 8096) {
		field.invalidate(AJS.format('Max length is 8,096 characters.'));
	} else {
		field.validate();
	}
	syncGheServerBtn();
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

const verifyGitHubServerUrl = (gheServerURL, apiKeyHeader, apiKeyValue) => {
	const csrf = document.getElementById("_csrf").value

	AP.context.getToken(function(token) {
		$.post("/jira/connect/enterprise", {
				gheServerURL,
				apiKeyHeader,
				apiKeyValue,
				_csrf: csrf,
				jwt: token
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
	const gheServerURL = gheServerURLElt.value.replace(/\/+$/, "");

	if ($("#gheServerBtnSpinner").is(":hidden")) {
		activeRequest();
		verifyGitHubServerUrl(
			gheServerURL,
			gheApiKeyHeaderElt ? gheApiKeyHeaderElt.value : '',
			gheApiKeyValueElt ? gheApiKeyValueElt.value : ''
		);
	}
});
