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
