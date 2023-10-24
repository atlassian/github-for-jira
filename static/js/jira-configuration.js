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
	AP.navigator.go( "addonmodule", { moduleKey: "spa-index-page" });
});

// TODO: passing JWT in query param is a security risk, we must either populate a session (if not already) or use cookies
$(".jiraConfiguration__table__repo_access").click(function (event) {
	const subscriptionId = $(event.target.parentElement).attr('data-subscription-id');
	AP.navigator.go(
		'addonmodule',
		{
			moduleKey: "gh-addon-subscription-repos",
			customData: { subscriptionId }
		}
	);
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
	AP.navigator.go( "addonmodule", { moduleKey: "spa-index-page" });
});

$(".configure-connection-link").click(function(event) {
	event.preventDefault();
	openChildWindow($(event.target).data("installation-link"));
});

const initializeBackfillDateInput = function (event) {
	const dateElement = document.getElementById('backfill-date-picker');
	const newBackfillDate = $(event.target).data('connection-backfill-since') ? new Date($(event.target).data('connection-backfill-since')) : new Date();
	newBackfillDate.setMonth(newBackfillDate.getMonth() - 6);
	dateElement.value = newBackfillDate.toISOString().split('T')[0];
	dateElement.max = new Date().toISOString().split('T')[0];
}

const setDisabledStatus = (el, status) => {
	el.prop("disabled", status);
	el.attr("aria-disabled", status.toString());
}

const restartBackfillPost = (data, url = "/jira/sync") => {
	setDisabledStatus($("#submit-backfill-data"), true);
	$.post(url, data)
		.done(() => {
			AP.navigator.reload();
		})
		.fail(() => {
			setDisabledStatus($("#submit-backfill-data"), false);
		});
};

$("#cancel-backfill").click(() => {
	document.getElementById("restart-backfill-modal").style.display = "none";
});

$(".sync-connection-link").click(event => {
	const installationId = $(event.target).data("installation-id");
	const appId = $(event.target).data("app-id");
	const csrfToken = document.getElementById("_csrf").value;

	document.getElementById("restart-backfill-modal").style.display = "block";

	AJS.$("#jiraConfiguration__restartBackfillModal__form").on("aui-valid-submit", event => {
		event.preventDefault();
		const commitsFromDate = document.getElementById('backfill-date-picker').value;
		const fullSyncCheckbox = document.getElementById('backfill-fullsync-checkbox');
		let syncType = undefined;
		if (fullSyncCheckbox && fullSyncCheckbox.checked) {
			syncType = "full";
		}
		window.AP.context.getToken(function (jwt) {
			restartBackfillPost({jwt, _csrf: csrfToken, installationId, commitsFromDate, appId, syncType, source: "backfill-button"});
		});
	});
});

$(".jiraConfiguration__syncErrorSummaryModal__closeBtn").click(event => {
	const installationId = $(event.target).data("installation-id");
	document.getElementById(`error-summary-modal-${installationId}`).style.display = "none";
});

$(".jiraConfiguration__errorSummary__btn").click(event => {
	const installationId = $(event.currentTarget).data("installation-id");
	const appId = $(event.currentTarget).data("app-id");
	const csrfToken = document.getElementById("_csrf").value;

	document.getElementById(`error-summary-modal-${installationId}`).style.display = "block";

	AJS.$(".jiraConfiguration__errorSummaryModal__form").on("aui-valid-submit", event => {
		event.preventDefault();
		window.AP.context.getToken(function (jwt) {
			restartBackfillPost({jwt, _csrf: csrfToken, installationId, undefined, appId, source: "backfill-retry"});
		});
	});
});

$("#restart-backfill-action-button, #restart-backfill").click(initializeBackfillDateInput);

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
	window.AP.context.getToken(function(token) {
		const child = openChildWindow(`/session/github/${$(event.target).data("app-uuid")}/configuration?ghRedirect=to`);
		child.window.jwt = token;
	});
});

const syncStatusBtn = document.getElementById("sync-status-modal-btn");
const syncStatusModal = document.getElementById("sync-status-modal");
const syncStatusCloseBtn = document.getElementById("status-close");
const genericModal = document.getElementById("modal");
const genericModalClose = document.getElementById("modal-close-btn");
const genericModalAction = document.getElementById("modal-action-btn");
const disconnectServerBtn = document.getElementsByClassName("disconnect-server-btn");
const disconnectAppBtn = document.getElementsByClassName("disconnect-app-btn");
const disconnectOrgBtn = document.getElementsByClassName("delete-connection-link");

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

const handleDisconnectRequest = (path, data) => {
	$.ajax({
		type: "DELETE",
		url: path,
		data,
		success: function() {
			AP.navigator.reload();
		},
		error: function (error) {
			// TODO - we should render an error here when the app fails to delete
		},
	});
}

const mapDisconnectRequest = (disconnectType, data) => {
	AP.context.getToken(function(token) {
		let payload = {
			jwt: token,
			jiraHost
		}

		switch (disconnectType) {
			case "server":
				payload.serverUrl = data.disconnectData;
				handleDisconnectRequest(`/jira/connect/enterprise`, payload);
				return;
			case "app":
				payload.uuid = data.disconnectData;
				handleDisconnectRequest(`/jira/connect/enterprise/app/${payload.uuid}`, payload);
				return;
			default:
				payload.gitHubInstallationId = data.disconnectData;
				payload.appId = data.optionalDisconnectData;
				handleDisconnectRequest("/jira/configuration", payload);
				return;
		}
	});
};

if (genericModalAction != null) {
	$(genericModalAction).click((event) => {
		event.preventDefault();
		const disconnectType = $(event.target).data("disconnect-type");
		const disconnectData = $(event.target).data("modal-data");
		const optionalDisconnectData = $(event.target).data("optional-modal-data");
		const data = { disconnectData, optionalDisconnectData }
		mapDisconnectRequest(disconnectType, data);
	});
}

const handleModalDisplay = (title, info, type, data) => {
	$(genericModal).show();
	$(".modal__header__icon").addClass("aui-iconfont-warning").empty().append("Warning icon");
	$(".modal__header__title").empty().append(title);
	$(".modal__information").empty().append(info);
	$(".modal__footer__actionBtn")
		.empty()
		.append("Disconnect")
		.attr("data-disconnect-type", type)
		.attr("data-modal-data", data.modalData)
		.attr("data-optional-modal-data", data.appId);
}

if (disconnectServerBtn != null) {
	$(disconnectServerBtn).click((event) => {
		event.preventDefault();
		const serverUrl = $(event.target).data("server-baseurl");
		const modalTitle = "Disconnect server?";
		const modalInfo = "Are you sure you want to disconnect your server? You'll need to recreate your GitHub apps and backfill historical data from your GitHub organisations and repositories again if you ever want to reconnect."
		const disconnectType = "server";
		const data = { modalData: serverUrl }
		handleModalDisplay(modalTitle, modalInfo, disconnectType, data);
		$(".modal__additionalContent").append(serverUrl).css('font-weight', 'bold');
	});
}

if (disconnectAppBtn != null) {
	$(disconnectAppBtn).click((event) => {
		event.preventDefault();
		const appName = $(event.target).data("app-name");
		const uuid = $(event.target).data("app-uuid");
		const modalTitle = `Disconnect ${appName}?`;
		const modalInfo = `Are you sure you want to delete your application, ${appName}? You’ll need to backfill your historical data again if you ever want to reconnect.`;
		const disconnectType = "app";
		const data = { modalData: uuid }
		handleModalDisplay(modalTitle, modalInfo, disconnectType, data);
	});
}

if (disconnectOrgBtn != null) {
	$(disconnectOrgBtn).click((event) => {
		event.preventDefault();
		const orgName = $(event.target).data("org-name");
		const gitHubInstallationId = $(event.target).data("installation-id");
		const appId = $(event.target).data("app-id");
		const displayName = orgName || `App ID: ${appId}`;
		const modalTitle = `Disconnect ${displayName}?`;
		const modalInfo = `Are you sure you want to disconnect your organization ${displayName}? This means that you will have to redo the backfill of historical data if you ever want to reconnect.`;
		const disconnectType = "org";
		const data = { modalData: gitHubInstallationId, appId };
		handleModalDisplay(modalTitle, modalInfo, disconnectType, data);
	});
}

if (genericModalClose != null) {
	$(genericModalClose).click((event) => {
		event.preventDefault();
		$(genericModal).hide();
		$(".modal__footer__actionBtn").removeAttr("data-disconnect-type");
		$(".modal__additionalContent").empty();
	});
}

$(".jiraConfiguration__table__repo_access").click(function (event) {
	const subscriptionId = $(event.target.parentElement).attr('data-subscription-id');
	AP.navigator.go(
		'addonmodule',
		{
			moduleKey: "gh-addon-subscription-repos",
			customData: { subscriptionId }
		}
	);
});

// When the user clicks anywhere outside of the modal, close it
window.onclick = function(event) {
	if (event.target.className === "jiraConfiguration__syncRetryModalOverlay") {
		syncStatusModal.style.display = "none";
	} else if (event.target.className === "jiraConfiguration__restartBackfillModalOverlay") {
		restartBackfillModal.style.display = "none";
	}
};

$(".jiraConfiguration__editGitHubApp").click(function(event) {
	event.preventDefault();
	const uuid = $(event.target).data("app-uuid");

	AP.navigator.go(
		'addonmodule',
		{
			moduleKey: "github-edit-app-page",
			customData: { uuid }
		}
	);
});

$(".jiraConfiguration__info__backfillDate-label").each((_, backfillSinceLabelEle) => {
	try {
		const isoStr = backfillSinceLabelEle.dataset.backfillSince;
		const backfillDate = new Date(isoStr);
		$(backfillSinceLabelEle).text(backfillDate.toLocaleDateString());
	} catch (e) {
		console.error(`Error trying to show the backfill since date for backfillSinceLabelEle`, e);
	}
});

$(document).ready(function () {
	AJS.$(".jiraConfiguration__table__backfillInfoIcon").tooltip();
	AJS.$(".jiraConfiguration__info__backfillDate-label").tooltip();
	AJS.$(".jiraConfiguration__restartBackfillModal__fullsync__label-icon").tooltip();

	$(".jiraConfiguration__info__backfillDate-label").each(function () {
		if ($(this).attr("data-backfill-since")) {
			const backfillDate = new Date($(this).attr("data-backfill-since"));
			$(this).text(backfillDate.toLocaleDateString(undefined, { dateStyle: "short" }));
			$(this).attr("title", (backfillDate.toLocaleDateString(undefined, { dateStyle: "long" })));
		}
	});
});
