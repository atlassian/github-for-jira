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
	if(document.body.dataset["useNewSpaExperience"] === "true") {
		AP.navigator.go( "addonmodule", { moduleKey: "spa-index-page" });
		return;
	}
	const queryParameter = $(this).data("gh-cloud") ? "?resetSession=true" : "?ghRedirect=to&resetSession=true";
	AP.context.getToken(function(token) {
		const child = openChildWindow("/session/github/configuration" + queryParameter);
		child.window.jwt = token;
	});
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

	if(document.body.dataset["useNewSpaExperience"] === "true") {
		AP.navigator.go( "addonmodule", { moduleKey: "spa-index-page" });
		return;
	}

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

const setSyncErrorModal = ({ modal, failedSyncErrors }) => {
	const ulElement = $(modal).find(
		".jiraConfiguration__errorSummaryModalContent .error-summary-border-top ul"
	);
	let htmlUrl = $(modal).data("html-url");
	ulElement.empty();
	if (failedSyncErrors?.PERMISSIONS_ERROR) {
		const liElement = $("<li>")
			.append($("<b>").text(`${failedSyncErrors?.PERMISSIONS_ERROR} `))
			.append(
				$("<span>").text(function () {
					return failedSyncErrors.PERMISSIONS_ERROR > 1
						? "tasks have"
						: "task has";
				})
			)
			.append(" not been backfilled. Please ")
			.append(
				`<a href="${htmlUrl}"
           			data-installation-link="${htmlUrl}"
           			target="_blank">accept permissions on GitHub
				</a>`
			)
			.append(
				" (you must be the admin of your organization), then retry backfill."
			);

		ulElement.append(liElement);
	}
	if (failedSyncErrors?.CONNECTION_ERROR) {
		const liElement = $("<li>")
			.append("We were unable to complete backfill for ")
			.append($("<b>").text(`${failedSyncErrors?.CONNECTION_ERROR} `))
			.append(
				$("<span>").text(function () {
					return failedSyncErrors?.CONNECTION_ERROR > 1
						? "repositories"
						: "repository";
				})
			)
			.append(
				" because something unexpected occurred. Please retry the backfill or raise a support ticket."
			);

		ulElement.append(liElement);
	}
};

const setErrorSummaryIconClick = ({
	backfillStatusPolling = false,
	failedSyncErrors = null,
}) => {
	$(".jiraConfiguration__errorSummary__btn").click((event) => {
		const installationId = $(event.currentTarget).data("installation-id");

		const appId = $(event.currentTarget).data("app-id");

		const csrfToken = document.getElementById("_csrf").value;
		const modal = document.getElementById(
			`error-summary-modal-${installationId}`
		);
		modal.style.display = "block";

		AJS.$(".jiraConfiguration__errorSummaryModal__form").on(
			"aui-valid-submit",
			(event) => {
				event.preventDefault();
				window.AP.context.getToken(function (jwt) {
					restartBackfillPost({
						jwt,
						_csrf: csrfToken,
						installationId,
						undefined,
						appId,
						source: "backfill-retry",
					});
				});
			}
		);
		if (backfillStatusPolling) {
			setSyncErrorModal({ modal, failedSyncErrors });
		}
	});
};

const setBackfillDateToolTip = () => {
	AJS.$(".jiraConfiguration__table__backfillInfoIcon").tooltip();
	AJS.$(".jiraConfiguration__info__backfillDate-label").tooltip();
	AJS.$(
		".jiraConfiguration__restartBackfillModal__fullsync__label-icon"
	).tooltip();

	$(".jiraConfiguration__info__backfillDate-label").each(function () {
		if ($(this).attr("data-backfill-since")) {
			const backfillDate = new Date($(this).attr("data-backfill-since"));
			$(this).text(
				backfillDate.toLocaleDateString(undefined, { dateStyle: "short" })
			);
			$(this).attr(
				"title",
				backfillDate.toLocaleDateString(undefined, { dateStyle: "long" })
			);
		}
	});
};

const getInprogressSubIds = () => {
	let subscriptionIds = [];
	$(".jiraConfiguration__table__row").each(function () {
		const repoStatusTd = $(this).children("td.repo-status");
		const subscriptionId = $(this).data("subscription-id");
		const infoContainer = repoStatusTd.children(
			`div.jiraConfiguration__infoContainer`
		);
		const syncStatusProgress = infoContainer.children(
			`span.jiraConfiguration__table__syncStatus`
		);
		if (
			!syncStatusProgress.hasClass("jiraConfiguration__table__finished") &&
			subscriptionId
		) {
			subscriptionIds.push(subscriptionId);
		}
	});
	return subscriptionIds;
};

const updateBackfilledRepoCount = ({ subscription, self }) => {
	const totalRepos = Number(subscription.totalRepos);
	const syncedRepos = Number(subscription.syncedRepos);
	const inprogressSyncStatus =
		syncedRepos === totalRepos
			? `${totalRepos}`
			: `${syncedRepos} / ${totalRepos}`;
	const repoCountTd = $(self).children("td.repo-count");
	const syncProgress = repoCountTd.children(
		"span.jiraConfiguration__table__syncCount"
	);
	syncProgress.text(` ${inprogressSyncStatus} `);
};

const toLowercaseHelper = (str) => str?.toString?.().toLowerCase() || "";
const replaceSpaceWithHyphenHelper = (str) =>
	str?.toString?.().replace(/ /g, "-") || "";

const isAllSyncSuccess = (conn) => {
	return conn && conn.syncStatus === "FINISHED" && !conn.syncWarning
		? true
		: false;
};

const updateBackfilledStatus = ({ subscription, self, installationId }) => {
	const isSyncComplete = subscription.isSyncComplete;
	const backfillSince = subscription.backfillSince;
	const failedSyncErrors = subscription.failedSyncErrors;
	const syncStatus = subscription.syncStatus;
	const repoStatusTd = $(self).children("td.repo-status");
	const infoContainer = repoStatusTd.children(
		`div.jiraConfiguration__infoContainer`
	);
	const inprogressIcon = infoContainer.children(
		`div.jiraConfiguration__infoSpinner`
	);
	const syncStatusProgress = infoContainer.children(
		`span.jiraConfiguration__table__syncStatus`
	);

	syncStatusProgress.removeClass(function (index, className) {
		return (className.match(/\bjiraConfiguration__table__\S*/g) || []).join(
			" "
		);
	});
	syncStatusProgress.addClass("jiraConfiguration__table__syncStatus");
	let syncStatusClassName = toLowercaseHelper(syncStatus);
	syncStatusClassName = replaceSpaceWithHyphenHelper(syncStatusClassName);
	syncStatusProgress.addClass(
		`jiraConfiguration__table__${syncStatusClassName}`
	);

	if (isSyncComplete) {
		inprogressIcon.css("display", "none");
		if (isAllSyncSuccess(subscription)) {
			if (backfillSince) {
				const backfillSinceDate = new Date(backfillSince);
				const formattedDate = backfillSinceDate.toISOString();
				infoContainer.append(
					`<div class="jiraConfiguration__info__backfillDate">
						<span>Backfilled from:</span><span class="jiraConfiguration__info__backfillDate-label" data-backfill-since="${backfillSince}">${formattedDate}</span>
						<span class="jiraConfiguration__table__backfillInfoIcon aui-icon aui-iconfont-info-filled" title="If you want to backfill more data, choose &quot;Continue backfill&quot; in the settings menu on the right">Information</span>
					</div>`
				);
				setBackfillDateToolTip();
			} else {
				infoContainer.append(
					'<div class="jiraConfiguration__info__backfillDate">All commits backfilled</span>'
				);
			}
		}
		if (failedSyncErrors) {
			var oldErrorLink = document.getElementById("error-summary");
			if (oldErrorLink) {
				oldErrorLink.remove();
			}
			infoContainer.append(
				`<a
				class="jiraConfiguration__errorSummary__btn"
				href="#"
				data-installation-id="${installationId}"
				data-app-id
				id="error-summary"
				>
		  			<span class="aui-icon aui-icon-small aui-iconfont-warning">Show Sync Warnings</span>
				</a>`
			);
			setErrorSummaryIconClick({
				backfillStatusPolling: true,
				failedSyncErrors,
			});
		}
	}
	syncStatusProgress.text(syncStatus);
};

let fetchBackfillStateTimeout;
function fetchAllConnectionsBackfillStatus() {
	const subscriptionIds = getInprogressSubIds();
	if (subscriptionIds.length > 0) {
		$.ajax({
			type: "GET",
			url: `/jira/subscriptions/backfill-status/?subscriptionIds=${subscriptionIds}`,
			success: (response) => {
				const data = response.data;
				const subscriptions = data.subscriptions;

				const isBackfillComplete = data.isBackfillComplete;

				$(".jiraConfiguration__table__row").each(function () {
					const self = this;
					let subscriptionId = $(self).data("subscription-id");
					let installationId = $(self).data("installation-id");

					if (subscriptionId in subscriptions) {
						const subscription = subscriptions[subscriptionId];
						updateBackfilledRepoCount({
							subscription,
							self,
						});
						updateBackfilledStatus({ subscription, self, installationId });
					} else {
						$(`#${subscriptionId}-syncCount`).css("display", "none");
					}
				});
				if (!isBackfillComplete) {
					fetchBackfillStateTimeout = setTimeout(
						fetchAllConnectionsBackfillStatus,
						6000
					);
				} else {
					clearTimeout(fetchBackfillStateTimeout);
				}
			},
			error: () => {
				console.log("failure in fetching  backfill status of connections.");
			},
		});
	}
}

$(document).ready(function () {
	const isBackfillingStatusPollingEnabled = $(".jiraConfiguration").data(
		"enable-backfilling-status-polling"
	);

	if (isBackfillingStatusPollingEnabled) {
		const hasConnections = $(".jiraConfiguration").data("has-connections");
		if (hasConnections) {
			fetchAllConnectionsBackfillStatus();
		}
	}

	setBackfillDateToolTip();
	setErrorSummaryIconClick({});

	AJS.$(
		".jiraConfiguration__restartBackfillModal__fullsync__label-icon"
	).tooltip();
});
