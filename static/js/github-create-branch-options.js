const params = new URLSearchParams(window.location.search.substring(1));
const jiraHost = params.get("xdm_e");

const goToCreateBranch = () => {
  $(".gitHubCreateBranchOptions").hide();
  $(".gitHubCreateBranchOptions__loading").show();

  AP.context.getToken(token => {
		const child = window.open(getCreateBranchTargetUrl());
		child.window.jiraHost = jiraHost;
		child.window.jwt = token;
  });
}

const getCreateBranchTargetUrl = () => {
	const searchParams = new URLSearchParams(window.location.search.substring(1));
	const issueKey = searchParams.get("issueKey");
	const issueSummary = searchParams.get("issueSummary");
	if ($("#gitHubCreateBranchOptions__cloud").hasClass("gitHubCreateBranchOptions__selected")) {
		return`session/github/create-branch?issueKey=${issueKey}&issueSummary=${issueSummary}`;
	}
	const uuid = $("#ghServers").select2("val");
	return `session/github/${uuid}/create-branch?issueKey=${issueKey}&issueSummary=${issueSummary}&ghRedirect=to`;
}

$(document).ready(() => {

  $("#ghServers").auiSelect2();

  $(".gitHubCreateBranchOptions__option").click((event) => {
    event.preventDefault();
    ghServerOptionHandler(event);
  });

  $("#createBranchOptionsForm").submit((event) => {
    event.preventDefault();
		goToCreateBranch();
	});

  if(isAutoRedirect()) {
    goToCreateBranch();
  }
});

const ghServerOptionHandler = (event) => {
  event.preventDefault();
  $(".gitHubCreateBranchOptions__option").removeClass("gitHubCreateBranchOptions__selected");
  $(event.target).addClass("gitHubCreateBranchOptions__selected");

  if ($(event.target).attr("id") == "gitHubCreateBranchOptions__enterprise") {
    $(".gitHubCreateBranchOptions__serversContainer").show();
  } else {
    $(".gitHubCreateBranchOptions__serversContainer").hide();
  }
};

const isAutoRedirect = () => {
  const hasCloudServer = $("#createBranchOptionsForm").attr("data-has-cloud-server");
  const gheServersCount = $("#createBranchOptionsForm").attr("data-ghe-servers-count");
  // Only GitHub cloud server connected
	if (hasCloudServer && gheServersCount == 0) {
		return true;
	}
	// Only single GitHub Enterprise connected
	if (!hasCloudServer && gheServersCount == 1) {
		return true;
	}

  return false;

};

