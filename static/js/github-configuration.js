/* globals $ */
$('.install-link').click(function (event) {
  event.preventDefault();

  $.post(window.location.href, {
    installationId: $(event.target).data('installation-id'),
    _csrf: document.getElementById('_csrf').value,
    clientKey: document.getElementById('clientKey').value
  }, function (data) {
    if (data.err) {
      console.log(data.err);
    }
    window.close();
  })
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
