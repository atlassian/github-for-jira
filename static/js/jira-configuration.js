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
	const queryParameter = $(this).data("gh-cloud") ? "" : "?ghRedirect=to";
	AP.context.getToken(function(token) {
		const child = openChildWindow("/session/github/configuration" + queryParameter);
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

const initializeBackfillDateInput = function () {
	const dateElement = document.getElementById('backfill-date-picker');
	const date = new Date();
	date.setFullYear(date.getFullYear() - 1);
	dateElement.value = date.toISOString().split('T')[0];
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
	const jiraHost = $(event.target).data("jira-host");
	const csrfToken = document.getElementById("_csrf").value;

	document.getElementById("restart-backfill-modal").style.display = "block";

	AJS.$("#jiraConfiguration__restartBackfillModal__form").on("aui-valid-submit", event => {
		event.preventDefault();
		const commitsFromDate = document.getElementById('backfill-date-picker').value;
		window.AP.context.getToken(function (jwt) {
			restartBackfillPost({jwt, _csrf: csrfToken, jiraHost, syncType: "full", installationId, commitsFromDate});
		});
	});
});

initializeBackfillDateInput();

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

const mapDisconnectRequest = (disconnectType, disconnectData) => {
	AP.context.getToken(function(token) {
		let data = {
			jwt: token,
			jiraHost
		}

		switch (disconnectType) {
			case "server":
				data.serverUrl = disconnectData;
				handleDisconnectRequest(`/jira/connect/enterprise`, data);
				return;
			case "app":
				data.uuid = disconnectData;
				handleDisconnectRequest(`/jira/connect/enterprise/app/${disconnectData}`, data);
				return;
			default:
				data.installationId = disconnectData;
				handleDisconnectRequest("/jira/configuration", data);
				return;
		}
	});
};

if (genericModalAction != null) {
	$(genericModalAction).click((event) => {
		event.preventDefault();
		const disconnectType = $(event.target).data("disconnect-type");
		const disconnectData = $(event.target).data("modal-data");
		mapDisconnectRequest(disconnectType, disconnectData);
	});
}

const handleModalDisplay = (title, info, type, data) => {
	$(genericModal).show();
	$(".modal__header__icon").addClass("aui-iconfont-warning").empty().append("Warning icon");
	$(".modal__header__title").empty().append(title);
	$(".modal__information").empty().append(info);
	$(".modal__footer__actionBtn").empty().append("Disconnect").attr("data-disconnect-type", type).attr("data-modal-data", data);
}

if (disconnectServerBtn != null) {
	$(disconnectServerBtn).click((event) => {
		event.preventDefault();
		const serverUrl = $(event.target).data("server-baseurl");
		const modalTitle = "Disconnect server?";
		const modalInfo = "Are you sure you want to disconnect your server? You'll need to recreate your GitHub apps and backfill historical data from your GitHub organisations and repositories again if you ever want to reconnect."
		const disconnectType = "server";
		handleModalDisplay(modalTitle, modalInfo, disconnectType, serverUrl);
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
		handleModalDisplay(modalTitle, modalInfo, disconnectType, uuid);
	});
}

if (disconnectOrgBtn != null) {
	$(disconnectOrgBtn).click((event) => {
		event.preventDefault();
		const orgName = $(event.target).data("org-name");
		const installationId = $(event.target).data("installation-id");
		const modalTitle = `Disconnect ${orgName}?`;
		const modalInfo = `Are you sure you want to disconnect your organization ${orgName}? This means that you will have to redo the backfill of historical data if you ever want to reconnect.`;
		const disconnectType = "org";
		handleModalDisplay(modalTitle, modalInfo, disconnectType, installationId);
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


