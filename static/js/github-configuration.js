/* globals $ */
$('.install-link').click(function (event) {
  event.preventDefault()
	const uuid = location.href.split("/")[4];
	const url = uuid ? `/github/${uuid}/configuration` : `/github/configuration`;

  $.post(url, {
    installationId: $(event.target).data('installation-id'),
    _csrf: document.getElementById('_csrf').value,
    clientKey: document.getElementById('clientKey').value
  }, function (data) {
    if (data.err) {
      return console.log(data.err)
    }
    window.close()
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
