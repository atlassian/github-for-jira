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
	window.AP.context.getToken(function(token) {
		const child = openChildWindow("/session/github/configuration");
		child.window.jiraHost = jiraHost;
		child.window.jwt = token;
	});
});

$(".add-enterprise-link").click(function(event) {
	event.preventDefault();
	AP.navigator.go(
		'addonmodule',
		{
			moduleKey: "github-list-servers-page"
		}
	);
});

$(".select-github-product-link").click(function(event) {
	event.preventDefault();

	AP.navigator.go(
		'addonmodule',
			{
				moduleKey: "github-select-product-page"
			}
		);
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


const getInitialBackfillDate = function () {
	const date = new Date();
	date.setFullYear(date.getFullYear() - 1);
	return date.toISOString().split('T')[0];
}

// Restart backfill block
const restartBackfillModal = document.getElementById("restart-backfill-modal");
const backfillDatePicker = document.getElementById('backfill-date-picker');
const csrfToken = document.getElementById("_csrf").value;
backfillDatePicker.value = getInitialBackfillDate();

const restartBackfillPost = function (token, csrfToken, jiraHost, installationId, commitsFromDate) {
	$.ajax({
		type: "POST",
		url: "/jira/sync",
		data: {
			installationId,
			jiraHost,
			commitsFromDate,
			syncType: "full",
			jwt: token,
			_csrf: csrfToken
		},
		success: function () {
			AP.navigator.reload();
		},
		error: function () {

		}
	});
};

$(".sync-connection-link").click(function (event) {
	const $cancelBackfillEl = $("#cancel-backfill");
	const installationId = $(event.target).data("installation-id");
	const jiraHost = $(event.target).data("jira-host");

	// Display modal and setup
	restartBackfillModal.style.display = "block";
	$cancelBackfillEl.click(function () {
		restartBackfillModal.style.display = "none";
	});

	AJS.$("#jiraConfiguration__restartBackfillModal__form").on("aui-valid-submit", event => {
		event.preventDefault();
		const commitsFromDate = document.getElementById('backfill-date-picker').value;
		window.AP.context.getToken(function (token) {
			restartBackfillPost(token, csrfToken, jiraHost, installationId, commitsFromDate);
		});
	});

});

window.addEventListener('click', function(event) {
	if (event.target.className === "jiraConfiguration__restartBackfillModalOverlay") {
		restartBackfillModal.style.display = "none";
	}
});


$('.jiraConfiguration__option').click(function (event) {
	event.preventDefault();
	$('.jiraConfiguration__option').removeClass('jiraConfiguration__selected');
	$(event.target).addClass('jiraConfiguration__selected');

	switch ($(event.target).attr('id')) {
		case 'jiraConfiguration__optionCloud':
			$('.jiraConfiguration__cloudContainer').show();
			$('.jiraConfiguration__enterpriseContainer').hide();
			break;
		case 'jiraConfiguration__optionEnterprise':
			$('.jiraConfiguration__enterpriseContainer').show();
			$('.jiraConfiguration__cloudContainer').hide();
			break;
		default:
			$('.jiraConfiguration__cloudContainer').show();
			$('.jiraConfiguration__enterpriseContainer').show();
	}
});

$(".jiraConfiguration__connectNewApp").click((event) => {
	event.preventDefault();
	AP.navigator.go(
		"addonmodule",
		{
			moduleKey: "github-app-creation-page",
			customData: { serverUrl: $(event.target).data("server-baseurl") }
		}
	)
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
window.addEventListener('click', function(event) {
	if (event.target.className === "jiraConfiguration__syncRetryModalOverlay") {
		syncStatusModal.style.display = "none";
	}
});
