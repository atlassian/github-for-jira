// `params` and `jiraHost` are already defined in the `jira-select-card-option.js`
const issueKey = params.get("issueKey");
const issueSummary = params.get("issueSummary");

$(document).ready(() => {

  $("#ghServers").auiSelect2();

  $(".jiraSelectGitHubProduct__options__card.horizontal.server").click(function (event) {
    event.preventDefault();

    $(".jiraSelectGitHubProduct__selectServerInstance").css("display", "block");
  });

  $(".jiraSelectGitHubProduct__options__card.horizontal.cloud").click(function (event) {
    event.preventDefault();

    $(".jiraSelectGitHubProduct__selectServerInstance").css("display", "none");
  });

  $(".gitHubCreateBranchOptions__actionBtn").click(function (event) {
    event.preventDefault();
    const uuid = $("#ghServers").select2("val");

    if ($(".optionsCard").data('type') === "cloud") {
      goToCreateBranch(createUrlForGH(issueKey, issueSummary), false);
    } else {
      goToCreateBranch(createUrlForGH(issueKey, issueSummary, uuid), false);
    }
  });

  const {isRedirect, url} = isAutoRedirect();
  if(isRedirect) {
    goToCreateBranch(url, true);
  } else {
    $(".gitHubCreateBranchOptions").show();
    $(".gitHubCreateBranchOptions__loading").hide();
  }

});

const createUrlForGH = (issueKey, issueSummary, uuid) => {
  return uuid ?
    `session/github/${uuid}/create-branch?issueKey=${issueKey}&issueSummary=${issueSummary}&ghRedirect=to` :
    `session/github/create-branch?issueKey=${issueKey}&issueSummary=${issueSummary}`;
};

const goToCreateBranch = (url, isRedirect) => {
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
};

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


