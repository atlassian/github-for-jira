/* globals $, AP */
const params = new URLSearchParams(window.location.search.substring(1));
const jiraHost = params.get("xdm_e");
const GITHUB_CLOUD = ["github.com", "www.github.com"];

AJS.formValidation.register(['ghe-url'], (field) => {
	const inputURL = field.el.value;
	try {
		const { protocol, hostname } = new URL(inputURL);

		if (!/^https?:$/.test(protocol)) {
			field.invalidate(AJS.format('The entered URL is not valid. <a href="#">Learn more</a>.'));
		}
		else if (GITHUB_CLOUD.includes(hostname)) {
			field.invalidate(AJS.format('The entered URL is a GitHub Cloud site. <a href="/session/github/configuration" target="_blank">Connect a GitHub Cloud site<a/>.'));
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

const verifyGitHubServerUrl = (gheServerURL, installationId) => {
  $("#jiraServerUrl__form :input").prop("disabled", true);

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
					// TODO - Update the error from backend and render the correct component
          $(".jiraServerUrl__validationError").show();
				}

        $("#jiraServerUrl__form :input").prop("disabled", false);
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
