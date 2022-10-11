const params = new URLSearchParams(window.location.search.substring(1));
const jiraHost = params.get("xdm_e");

function openChildWindow(url, redirectUrl) {
	const child = window.open(url);
	const interval = setInterval(function () {
		if (child.closed) {
			clearInterval(interval);
			window.location.href = redirectUrl;
		}
	}, 500);

	return child;
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
		getGitHubToken();
	});

});

const getGitHubToken = () => {
	const gitHubToken = $("gitHubToken").val();
	// If we don't have a GitHub token we need to go get one
	if (!gitHubToken) {
		AP.context.getToken(function(token) {
			const child = openChildWindow("/github/success", getCreateBranchTargetUrl());
			child.window.jiraHost = jiraHost;
			child.window.jwt = token;
		});
		return;
	}
	window.location.href = getCreateBranchTargetUrl();
}

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

