// `params` and `jiraHost` are already defined in the `jira-select-card-option.js`
const issueKey = params.get("issueKey");
const issueSummary = params.get("issueSummary");

$(document).ready(() => {
  $("#ghServers").auiSelect2();
  const {isRedirect, url} = isAutoRedirect();

  if(isRedirect) {
    goToCreateBranch(url);
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
			console.log("TRY CLICK CLOUD");
			console.log(createUrlForGH(undefined, true));
      goToCreateBranch(createUrlForGH(undefined, true));
    } else {
			console.log("TRY CLICK GHE");
			console.log(createUrlForGH(uuid, true));
      goToCreateBranch(createUrlForGH(uuid, true));
    }
  });
});

const createUrlForGH = (uuid, multiGHInstance) => {
	const jiraHost = $("#jiraHost").val();
  return uuid ?
    `session/github/${uuid}/create-branch?issueKey=${issueKey}&issueSummary=${issueSummary}&jiraHost=${jiraHost}&ghRedirect=to&multiGHInstance=${multiGHInstance}` :
    `session/github/create-branch?issueKey=${issueKey}&issueSummary=${issueSummary}&jiraHost=${jiraHost}&multiGHInstance=${multiGHInstance}`;
};

const goToCreateBranch = (url) => {
	document.location.href = url;
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
      url: createUrlForGH(),
      isRedirect: true
    };
	}
	// Only single GitHub Enterprise connected
	if (!hasCloudServer && gheServersCount === 1) {
    const uuid = $("#ghServers").select2("val");

    return {
      url: createUrlForGH(uuid),
      isRedirect: true
    };
	}

  return {
    url: null,
    isRedirect: false
  };
};
