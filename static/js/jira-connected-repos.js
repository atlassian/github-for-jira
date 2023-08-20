$(document).ready(() => {
	// to get the focus back on seach bar after comp reload
	$('#repo-search').focus();
	const params = new URLSearchParams(window.location.search.substring(1));
	const repoSearch = params.get("repoName");
	if (repoSearch) {
		$("#repo-search").val(repoSearch);
	}
	const syncStatus = params.get("syncStatus");
	if(syncStatus) {
		$("#status-filter").val(syncStatus);
	}

	$(".page-selector").click((event) => {
		const pageNumber = $(event.target).attr('data-page-num');
		loadRepos(pageNumber);
	});

	$("#repo-search-btn").click(() => {
		loadRepos(1);
	});

	$("#status-filter").on("change", () => {
		loadRepos(1);
	});
	let repoSearchTimeoutId;
	$('#repo-search').on('input', function() {
		// re-render the original list after clearing the search bar
		if($(this).val().length === 0) {
			loadRepos(1)
		}
		// search bar is using de-bouncing
		clearTimeout(repoSearchTimeoutId);
		repoSearchTimeoutId = setTimeout(function() {
		  loadRepos(1);
		}, 500);
	});

	const loadRepos = (pageNumber ) => {
		const syncStatus =$("#status-filter").val();
		const repoName = $("#repo-search").val();
		const subscriptionId = $(".jiraConnectedRepos_pagination").attr('data-subscription-id');
		AP.context.getToken(function (token) {
			window.location.href = `/jira/subscription/${subscriptionId}/repos?jwt=${token}&page=${pageNumber}&repoName=${repoName}&syncStatus=${syncStatus}`;
		});
	};

	$(".jiraConnectedRepos__table__cell__repoName").click((event) => {
		document.getElementById("backfill-status-modal").style.display = "block";
		const repoName = event.currentTarget.getAttribute("data-repo-name");
		$("#jiraConnectedRepos__backfillStatusModal__header__repoName").text(repoName);
		//set branch status icon
		const  branchStatus = event.currentTarget.getAttribute("data-branch-status");
		const branchStatusIconInfo = getStatusIconInfo(branchStatus);
		$(".jiraConfiguration__restartBackfillModal__content__branchStatus span").attr("class", `aui-icon ${branchStatusIconInfo.cls}`);
		$(".jiraConfiguration__restartBackfillModal__content__branchStatus span").attr("title", branchStatusIconInfo.title);
		//set commit status icon
		const  commitStatus = event.currentTarget.getAttribute("data-commit-status");
		const commitStatusIconInfo = getStatusIconInfo(commitStatus);
		$(".jiraConfiguration__restartBackfillModal__content__commitStatus span").attr("class", `aui-icon ${commitStatusIconInfo.cls}`);
		$(".jiraConfiguration__restartBackfillModal__content__commitStatus span").attr("title", commitStatusIconInfo.title);
		//set pull request status icon
		const  pullRequestStatus = event.currentTarget.getAttribute("data-pull-request-status");
		const pullRequestStatusIconInfo = getStatusIconInfo(pullRequestStatus);
		$(".jiraConfiguration__restartBackfillModal__content__pullRequestStatus span").attr("class", `aui-icon ${pullRequestStatusIconInfo.cls}`);
		$(".jiraConfiguration__restartBackfillModal__content__pullRequestStatus span").attr("title", pullRequestStatusIconInfo.title);
		//set build status icon
		const  buildStatus = event.currentTarget.getAttribute("data-build-status");
		const buildStatusIconInfo = getStatusIconInfo(buildStatus);
		$(".jiraConfiguration__restartBackfillModal__content__buildStatus span").attr("class", `aui-icon ${buildStatusIconInfo.cls}`);
		$(".jiraConfiguration__restartBackfillModal__content__buildStatus span").attr("title", buildStatusIconInfo.title);
		//set build status icon
		const  deploymentStatus = event.currentTarget.getAttribute("data-deployment-status");
		const deploymentStatusIconInfo = getStatusIconInfo(deploymentStatus);
		$(".jiraConfiguration__restartBackfillModal__content__deploymentStatus span").attr("class", `aui-icon ${deploymentStatusIconInfo.cls}`);
		$(".jiraConfiguration__restartBackfillModal__content__deploymentStatus span").attr("title", deploymentStatusIconInfo.title);
		//set error reason
		const  dataFailedCode = event.currentTarget.getAttribute("data-failed-code");
		if(dataFailedCode && dataFailedCode.length > 0) {
			$(".jiraConfiguration__restartBackfillModal__content__ErrorContainer").css("display", "flex");
			$(".jiraConfiguration__restartBackfillModal__content__errorReason").text(mapErrorToMessage(dataFailedCode));
		} else {
			$(".jiraConfiguration__restartBackfillModal__content__ErrorContainer").css("display", "none");
		}
	});

	$(".jiraConnectedRepos__backfillStatusModal__closeBtn").click(()=> {
		document.getElementById("backfill-status-modal").style.display = "none";
	});
});

const getStatusIconInfo = (status) => {
	if(status == "complete") {
		return  { cls: "aui-iconfont-approve", title: "COMPLETE" }
	}
	if(status == "failed") {
		return  { cls: "aui-iconfont-cross-circle", title: "FAILED" }
	}
	if(status == "pending") {
		return  { cls: "aui-iconfont-recent-filled", title: "IN PROGRESS" }
	}
}

const mapErrorToMessage = (errorCode) => {
	if(errorCode == "CONNECTION_ERROR") {
		return "This is caused by connection error. To fix this, restarting backfilling may rectify this error. If this error persists, please contact the Atlassian support team."
	} 
	return errorCode;
};

