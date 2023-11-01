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

const handleDisconnectRequest = (path, data, callback) => {
	$(".modal__header__container").hide();
	$(".modal__information").hide();
	$(".modal__footer").hide();
	$(".modal__spinner").removeClass("hidden");

	$.ajax({
		type: "DELETE",
		url: path,
		data,
		success: function() {
			// For deleting GH server or a GH server app
			if (callback) {
				callback();
				$(".modal__spinner").addClass("hidden");
				$(".modal__information").show();
				$(".modal__header__container").show();
				$(".modal__footer").show();
			} else { // For deleting an individual GH server app connection
				AP.navigator.reload();
			}
		},
		error: function (error) {
			// TODO - we should render an error here when the app fails to delete
			console.error("Failed: ", error);
		}
	});
}

const deleteAppsInGitHub = (GHEServerUrl, appName) => {
	$(".modal__header__icon").remove();
	let content = "";
	if (!appName) {
		// Get the list of all the apps within the GH Enterprise server
		const apps = $(`.jiraConfiguration__enterpriseServer__header__container[data-server-baseurl='${GHEServerUrl}'] + .jiraConfiguration__enterpriseConnections > details`);
		if ($(apps).length > 0) {
			$(".modal__header__title").empty().append("Server disconnected");
			content += "<p style='margin-bottom: 12px;'>You can now delete these unused apps from your GitHub server. Select the app, then in GitHub select <b>Delete GitHub app</b>.</p>";
			$(apps).map((index, app) => {
				const serverAppName = $(app).find(".jiraConfiguration__optionHeader").text();
				content += `<span style="margin-right: 12px">&#8226;</span><a target="_blank" href="${GHEServerUrl}/settings/apps/${serverAppName}/advanced">${serverAppName}</a><br/>`;
			});
		}
	} else {
		$(".modal__header__title").empty().append("App disconnected");
		content += `<p style='margin-bottom: 12px;'>To delete this app from your GitHub server, <a target=\"_blank\" href=\"${GHEServerUrl}/settings/apps/${appName}/advanced\">go to the app in GitHub</a> and select <b>Delete GitHub App</b>.</p>`;
	}

	$(".modal__information").empty().append(content);

	// Adding a close button which refreshes the iframe
	$(".modal__footer").empty()
		.append("<button class=\"aui-button aui-button-primary modal__footer__close\">Close</button>");
	$(".modal__footer__close").click(() => {
		AP.navigator.reload();
	});
}

const mapDisconnectRequest = (disconnectType, data) => {
	AP.context.getToken(function(token) {
		let payload = {
			jwt: token,
			jiraHost
		}
		// Replacing single quotes by double in order to parse the JSON properly
		const parsedData = JSON.parse(data.replace(/'/g, '"'));

		switch (disconnectType) {
			case "server":
				payload.serverUrl = parsedData.serverUrl;
				handleDisconnectRequest(`/jira/connect/enterprise`, payload, () => {
					deleteAppsInGitHub(parsedData.serverUrl);
				});
				return;
			case "app":
				payload.uuid = parsedData.uuid;
				handleDisconnectRequest(`/jira/connect/enterprise/app/${payload.uuid}`, payload, () => {
					deleteAppsInGitHub(parsedData.serverUrl, parsedData.appName);
				});
				deleteAppsInGitHub(parsedData);
				return;
			default:
				payload.gitHubInstallationId = parsedData.gitHubInstallationId;
				payload.appId = parsedData.appId;
				handleDisconnectRequest("/jira/configuration", payload);
				return;
		}
	});
};

if (genericModalAction != null) {
	$(genericModalAction).click((event) => {
		event.preventDefault();
		const disconnectType = $(event.target).data("disconnect-type");
		const data = $(event.target).data("modal-data");
		mapDisconnectRequest(disconnectType, data);
	});
}

const handleModalDisplay = (title, info, type, data) => {
	$(genericModal).show();
	$(".modal__header__icon").addClass("aui-iconfont-warning").empty().append("Warning icon");
	$(".modal__header__title").empty().append(title);
	$(".modal__information").empty().append(info);

	// Modal data is a JSON, so stringified using single quotes
	const stringifiedData = JSON.stringify(data.modalData).replace(/"/g, "'");
	$(".modal__footer__actionBtn")
		.empty()
		.append("Disconnect")
		.attr("data-disconnect-type", type)
		.attr("data-modal-data", stringifiedData);
}

if (disconnectServerBtn != null) {
	$(disconnectServerBtn).click((event) => {
		event.preventDefault();
		const serverUrl = $(event.target).data("server-baseurl");
		const modalTitle = "Are you sure you want to disconnect this server?";
		const modalInfo = "To reconnect this server, you'll need to create new GitHub apps and import data about its organizations and repositories again."
		const disconnectType = "server";
		const data = { modalData: { serverUrl } }
		handleModalDisplay(modalTitle, modalInfo, disconnectType, data);
	});
}

if (disconnectAppBtn != null) {
	$(disconnectAppBtn).click((event) => {
		event.preventDefault();
		const appName = $(event.target).data("app-name");
		const uuid = $(event.target).data("app-uuid");
		const serverUrl = $(event.target).data("app-server-url");
		const modalTitle = `Are you sure you want to disconnect this app?`;
		const modalInfo = `To reconnect this app, you'll need to recreate it and import data about its organizations and repositories again.`;
		const disconnectType = "app";
		const data = { modalData: { uuid, appName, serverUrl } }
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
		const data = { modalData: { gitHubInstallationId, appId } };
		handleModalDisplay(modalTitle, modalInfo, disconnectType, data);
	});
}

if (genericModalClose != null) {
	$(genericModalClose).click((event) => {
		event.preventDefault();
		$(genericModal).hide();
		$(".modal__footer__actionBtn").removeAttr("data-disconnect-type");
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
