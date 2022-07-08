/**
 * This method passes a value to the Parent Window,
 * which is used to change the url of the Parent Window
 */
const updateParentWindowURL = () => {
  if (window.opener != null && !window.opener.closed && window.opener.document.getElementById("redirectToGitHubConfigPage")) {
    window.opener.document.getElementById("redirectToGitHubConfigPage").value = true;
  }
  window.close();
};

$('.install-link').click(function (event) {
  event.preventDefault()

  $.post('/github/configuration', {
    installationId: $(event.target).data('installation-id'),
    _csrf: document.getElementById('_csrf').value,
    clientKey: document.getElementById('clientKey').value
  }, function (data) {
    if (data.err) {
      return console.log(data.err)
    }
    updateParentWindowURL();
    window.close();
  })
})

$('.delete-link').click(function (event) {
  event.preventDefault()

  $.post('/github/subscription', {
    installationId: $(event.target).data('installation-id'),
    jiraHost: $(event.target).data('jira-host'),
    _csrf: document.getElementById('_csrf').value
  }, function (data) {
    if (data.err) {
      return console.log(data.err)
    }
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
