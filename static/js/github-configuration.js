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

const modalClose = document.getElementById("modal-close-btn");
const modalAction = document.getElementById("modal-action-btn");

$(".delete-subscription").click((event) => {
	event.preventDefault();
	const modalTitle = "Delete subscription";
	const orgName = $(event.target).data("org-name");
	const modalInfo = `Are you sure you want to delete the subscription for ${orgName}?`;
	const gitHubInstallationId = $(event.target).data("github-installation-id");
	const uuid = $(event.target).data("github-app-uuid");
	const data = { gitHubInstallationId, uuid, orgName }
	handleModalDisplay(modalTitle, modalInfo, data);
});

const handleModalDisplay = (title, info, data) => {
	$(".modal").show();
	$(".modal__header__icon").addClass("aui-iconfont-warning").empty().append("Warning icon");
	$(".modal__header__title").empty().append(title);
	$(".modal__information").empty().append(info);
	const { gitHubInstallationId, uuid, orgName } = data;

	$(".modal__footer__actionBtn")
		.empty()
		.append("Delete")
		.attr("data-github-installation-id", gitHubInstallationId)
		.attr("data-github-app-uuid", uuid)
		.attr("data-org-name", orgName)
		.addClass("delete-subscription-submit")
}

if (modalClose != null) {
	$(modalClose).click((event) => {
		event.preventDefault();
		$(document.getElementById("modal")).hide();
	});
}

if (modalAction != null) {
	$(modalAction).click((event) => {
		event.preventDefault();
		$(".delete-subscription-submit").attr("disabled", true);
		const gitHubInstallationId = $(event.target).data("github-installation-id");
		const csrfToken = document.getElementById("_csrf").value;
		const uuid = $(event.target).data("github-app-uuid");
		const path = uuid ? `/github/${uuid}/subscription` : "/github/subscription";

		$.ajax({
			type: "DELETE",
			url: `${path}/${gitHubInstallationId}`,
			data: {
				installationId: gitHubInstallationId,
				_csrf: csrfToken
			},
			success: function (data) {
				window.location.reload();
			},
			error: function (error) {
				$(".delete-subscription-submit").attr("disabled", false);
				console.log(error);
			},
		});
	});
}

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
