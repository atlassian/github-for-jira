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
      goToCreateBranch(createUrlForGH(issueKey, issueSummary), false);
    } else {
      goToCreateBranch(createUrlForGH(issueKey, issueSummary, uuid), false);
    }
  });
});

const createUrlForGH = (issueKey, issueSummary, uuid) => {
  return uuid ?
    `session/github/${uuid}/create-branch?issueKey=${issueKey}&issueSummary=${issueSummary}&ghRedirect=to` :
    `session/github/create-branch?issueKey=${issueKey}&issueSummary=${issueSummary}`;
};

const goToCreateBranch = () => {
	document.location.href = getCreateBranchTargetUrl();
}

const getCreateBranchTargetUrl = () => {
	const searchParams = new URLSearchParams(window.location.search.substring(1));
	const issueKey = searchParams.get("issueKey");
	const jiraHost = $("#jiraHost").val();
	const issueSummary = searchParams.get("issueSummary");
	if ($("#gitHubCreateBranchOptions__cloud").hasClass("gitHubCreateBranchOptions__selected")) {
		return`session/github/create-branch?issueKey=${issueKey}&issueSummary=${issueSummary}&jiraHost=${jiraHost}`;
	}
	const uuid = $("#ghServers").select2("val");
	return `session/github/${uuid}/create-branch?issueKey=${issueKey}&issueSummary=${issueSummary}&jiraHost=${jiraHost}&ghRedirect=to`;
}

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
      url: createUrlForGH(issueKey, issueSummary, uuid),
      isRedirect: true
    };
	}

  return {
    url: null,
    isRedirect: false
  };
};
