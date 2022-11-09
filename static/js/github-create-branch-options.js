// `params` and `jiraHost` are already defined in the `jira-select-card-option.js`
const issueKey = params.get("issueKey");
const issueSummary = params.get("issueSummary");

$(document).ready(() => {
  $("#ghServers").auiSelect2();
  const {isRedirect, url} = isAutoRedirect();

  if(isRedirect) {
    goToCreateBranch(url, true);
  } else {
    $(".gitHubCreateBranchOptions").show();
    $(".gitHubCreateBranchOptions__loading").hide();

    // When there are no cloud servers but multiple enterprise servers
    const hasCloudServer = parseInt($(".gitHubCreateBranchOptions").attr("data-has-cloud-server"));
    const gheServersCount = parseInt($(".gitHubCreateBranchOptions").attr("data-ghe-servers-count"));
    if (!hasCloudServer && gheServersCount > 1) {
      $(".jiraSelectGitHubProduct__options__container").hide();
      $(".jiraSelectGitHubProduct__selectServerInstance").show();
      $(".optionBtn").prop("disabled", false).attr("aria-disabled", "false").addClass("aui-button-primary");
    }
  }

  $(".jiraSelectGitHubProduct__options__card.horizontal.server").click((event) => {
    event.preventDefault();
    $(".jiraSelectGitHubProduct__selectServerInstance").show();
  });

  $(".jiraSelectGitHubProduct__options__card.horizontal.cloud").click((event) => {
    event.preventDefault();
    $(".jiraSelectGitHubProduct__selectServerInstance").hide();
  });

  $(".gitHubCreateBranchOptions__actionBtn").click((event) => {
    event.preventDefault();
    const uuid = $("#ghServers").select2("val");

    if ($(".optionsCard.selected").data('type') === "cloud") {
      goToCreateBranch(createUrlForGH(issueKey, issueSummary), false, true);
    } else {
      goToCreateBranch(createUrlForGH(issueKey, issueSummary, uuid), false, true);
    }
  });
});

const createUrlForGH = (issueKey, issueSummary, uuid, multiGHInstance) => {
  return uuid ?
    `session/github/${uuid}/create-branch?issueKey=${issueKey}&issueSummary=${issueSummary}&ghRedirect=to&multiGHInstance=${multiGHInstance}` :
    `session/github/create-branch?issueKey=${issueKey}&issueSummary=${issueSummary}&multiGHInstance=${multiGHInstance}`;
};

const goToCreateBranch = (url, isRedirect) => {
	if (AP && AP.context) {
		AP.context.getToken(token => {
			const child = window.open(url);
			child.window.jiraHost = jiraHost;
			child.window.jwt = token;
			if (isRedirect) {
				const childWindowTimer = setInterval(() => {
					if (child.closed) {
						AP.navigator.go("issue", { issueKey: params.get("issueKey") });
						clearInterval(childWindowTimer);
					}
				}, 500);
			}
		});
	} else {
		document.location.href = url;
	}
};

/**
 * Checks the number of cloud & enterprise servers and returns if the page should be redirected or not,
 * with the corresponding url for creating branch
 * @returns {{isRedirect: boolean, url: string | null}}
 */
const isAutoRedirect = () => {
  const hasCloudServer = parseInt($(".gitHubCreateBranchOptions").attr("data-has-cloud-server"));
  const gheServersCount = parseInt($(".gitHubCreateBranchOptions").attr("data-ghe-servers-count"));
  // Only GitHub cloud server connected
	if (hasCloudServer && gheServersCount === 0) {
		return {
      url: createUrlForGH(issueKey, issueSummary),
      isRedirect: true
    };
	}
	// Only single GitHub Enterprise connected
	if (!hasCloudServer && gheServersCount === 1) {
    const uuid = $("#ghServers").select2("val");

    return {
      url: createUrlForGH(issueKey, issueSummary, uuid, false),
      isRedirect: true
    };
	}

  return {
    url: null,
    isRedirect: false
  };
};


