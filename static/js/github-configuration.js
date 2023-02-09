/* globals $ */
$('.install-link').click(function (event) {
  event.preventDefault();
	event.currentTarget.setAttribute('disabled', true);
	hideErrorMessage();

	$.post(window.location.href, {
		installationId: $(event.target).data('installation-id'),
		_csrf: document.getElementById('_csrf').value,
		clientKey: document.getElementById('clientKey').value
	}, function (data) {
		event.currentTarget.removeAttribute("disabled");
		if (data.err) {
			showErrorMessage(data.err);
			console.log(data.err);
			return;
		}
		window.close();
	}).fail((err) => {
		event.currentTarget.removeAttribute("disabled");
		if (err.responseJSON) {
			const errorResponse = err.responseJSON;
			let message = err.responseJSON.err;
			if (errorResponse.errorCode) {
				message = mapErrorCodeToText(errorResponse.errorCode);
			}
			showErrorMessage(message);
		}
		console.log(err);
	});
})

$('.delete-link').click(function (event) {
  event.preventDefault();
	const gitHubInstallationId = $(event.target).data("github-installation-id");
	const csrfToken = document.getElementById("_csrf").value;
	const uuid = $(event.target).data("github-app-uuid");
	const path = uuid ? `/github/${uuid}/subscription` : "/github/subscription"

	$.post(path, {
		installationId: gitHubInstallationId,
		_csrf: csrfToken
	}, function (data) {
    if (data.err) {
      return console.log(data.err)
    }
		window.opener.postMessage({moduleKey: "github-post-install-page"}, window.location.origin);
    window.close()
  })
})

$(".sync-connection-link").click(function (event) {
	event.preventDefault();
	const installationId = $(event.target).data("installation-id");
	const jiraHost = $(event.target).data("jira-host");
	const csrfToken = document.getElementById("_csrf").value;

	$("#restart-backfill").prop("disabled", true);
	$("#restart-backfill").attr("aria-disabled", "true");

	$.ajax({
		type: "POST",
		url: "/jira/sync",
		data: {
			installationId,
			jiraHost,
			syncType: "full",
			_csrf: csrfToken,
		},
		success: function (data) {
			window.close();
		},
		error: function (error) {
			console.log(error);
			$("#restart-backfill").prop("disabled", false);
			$("#restart-backfill").attr("aria-disabled", "false");
		},
	});
});

const showErrorMessage = (messages) => {
  $(".gitHubConfiguration__serverError").show();
  $(".errorMessageBox__message").empty().append(`${messages}`);
};

const hideErrorMessage = () => {
  $(".has-errors").removeClass("has-errors");
  $(".error-message").remove();
  $(".gitHubConfiguration__serverError").hide();
};

const mapErrorCodeToText = (errorCode) => {
	if(errorCode == "MISSING_GITHUB_TOKEN") {
		return "The GitHub token is expired or missing. Please either refresh the browser or close the browser and open it again."
	}
}