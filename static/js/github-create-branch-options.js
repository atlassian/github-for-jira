const params = new URLSearchParams(window.location.search.substring(1));
const jiraHost = params.get("xdm_e");

function goToCreateBranch() {
	window.open(getCreateBranchTargetUrl(), "_blank")
}

const getCreateBranchTargetUrl = () => {
	if ($("#gitHubCreateBranchOptions__cloud").hasClass("gitHubCreateBranchOptions__selected")) {
		return`/github/create-branch?${window.location.search.substring(1)}`;
	}
	const uuid = $("#ghServers").select2("val");
	return `/github/${uuid}/create-branch?${window.location.search.substring(1)}`;
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

  const autoRedirect = $("#autoRedirect").val();
	if (autoRedirect) {
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

