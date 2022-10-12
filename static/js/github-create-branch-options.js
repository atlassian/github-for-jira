const params = new URLSearchParams(window.location.search.substring(1));
const jiraHost = params.get("xdm_e");

function goToCreateBranch() {

		// const child = openChildWindow("/session/github/configuration" + queryParameter);


	AP.context.getToken(function(token) {
		const child = window.open("/session/github/configuration", '_blank');
		console.log('jiraHost');
		console.log('jiraHost');
		console.log('jiraHost');
		console.log('jiraHost');
		console.log('jiraHost');
		console.log('jiraHost');
		console.log(jiraHost);
		child.window.jiraHost = jiraHost;
		child.window.jwt = token;
		$("#loadingScreen").css('display', 'block');
		const interval = setInterval(function () {
			if (child.closed) {
				clearInterval(interval);
				window.location.href = getCreateBranchTargetUrl();
			}
		}, 100);
	});


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

