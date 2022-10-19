// `params` and `jiraHost` are already defined in the `jira-select-card-option.js`

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

  if(!isAutoRedirect()) {
    $(".gitHubCreateBranchOptions").show();
    $(".gitHubCreateBranchOptions__loading").hide();
  }
});


const isAutoRedirect = () => {
  const hasCloudServer = $("#createBranchOptionsForm").attr("data-has-cloud-server");
  const gheServersCount = $("#createBranchOptionsForm").attr("data-ghe-servers-count");
  // Only GitHub cloud server connected
	if (hasCloudServer && gheServersCount === 0) {
		return true;
	}
	// Only single GitHub Enterprise connected
	if (!hasCloudServer && gheServersCount === 1) {
		return true;
	}

  return false;
};

