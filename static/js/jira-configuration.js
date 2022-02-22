/* globals $, AP */
const params = new URLSearchParams(window.location.search.substring(1));
const jiraHost = params.get("xdm_e");

function openChildWindow(url) {
	const child = window.open(url);
	const interval = setInterval(function () {
		if (child.closed) {
			clearInterval(interval);
			AP.navigator.reload();
		}
	}, 100);

	return child;
}

$(".add-organization-link").click(function(event) {
	event.preventDefault();
	window.AP.context.getToken(function() {
		const child = openChildWindow("/session/github/configuration");
		child.window.jiraHost = jiraHost;
	});
});

$(".configure-connection-link").click(function(event) {
	event.preventDefault();
	openChildWindow($(event.target).data("installation-link"));
});

$(".delete-connection-link").click(function(event) {
	event.preventDefault();

	window.AP.context.getToken(function(token) {
		$.ajax({
			type: "DELETE",
			url: "/jira/configuration",
			data: {
				installationId: $(event.target).data("installation-id"),
				jwt: token,
				jiraHost: jiraHost
			},
			success: function(data) {
				AP.navigator.reload();
			}
		});
	});
});

$(".sync-connection-link").click(function(event) {
	event.preventDefault();
	const installationId = $(event.target).data("installation-id");
	const jiraHost = $(event.target).data("jira-host");
	const csrfToken = document.getElementById("_csrf").value;

	const $el = $("#restart-backfill");
	$el.prop("disabled", true);
	$el.attr("aria-disabled", "true");

	window.AP.context.getToken(function(token) {
		$.ajax({
			type: "POST",
			url: "/jira/sync",
			data: {
				installationId,
				jiraHost,
				syncType: "full",
				jwt: token,
				_csrf: csrfToken
			},
			success: function(data) {
				AP.navigator.reload();
			},
			error: function(error) {
				$el.prop("disabled", false);
				$el.attr("aria-disabled", "false");
			}
		});
	});
});

const syncStatusBtn = document.getElementById("sync-status-modal-btn");
const syncStatusModal = document.getElementById("sync-status-modal");
const syncStatusCloseBtn = document.getElementById("status-close");

if (syncStatusBtn != null) {
	syncStatusBtn.onclick = function() {
		syncStatusModal.style.display = "block";
	};
}

if (syncStatusCloseBtn != null) {
	syncStatusCloseBtn.onclick = function() {
		syncStatusModal.style.display = "none";
	};
}

// When the user clicks anywhere outside of the modal, close it
window.onclick = function(event) {
	if (event.target.className === "jiraConfiguration__syncRetryModalOverlay") {
		syncStatusModal.style.display = "none";
	}
};
