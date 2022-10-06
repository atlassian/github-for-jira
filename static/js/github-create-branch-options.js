function openChildWindow(url) {
	const child = window.open(url);
	const interval = setInterval(function () {
		if (child.closed) {
			clearInterval(interval);
			AP.navigator.reload();
		}
	}, 1000);

	return child;
}
$(document).ready(() => {

  $("#ghServers").auiSelect2();

  $(".gitHubCreateBranchOptions__option").click((event) => {
    event.preventDefault();
    ghServerOptionHandler(event);
  });

	// GITHUB LOGIN TETST CODES

	$("#ghbtn").click((event) => {
		event.preventDefault();
		AP.context.getToken(function(token) {
			const child = openChildWindow("/session/github/configuration");
			child.window.jiraHost = jiraHost;
			child.window.jwt = token;
		});
	});



  $("#createBranchOptionsForm").submit((event) => {
    event.preventDefault();
     if($("#gitHubCreateBranchOptions__cloud").hasClass("gitHubCreateBranchOptions__selected")) {
      window.location.href = `/github/create-branch?${window.location.search.substring(1)}`;
    } else {
      const uuid = $("#ghServers").select2("val");
      window.location.href = `/github/${uuid}/create-branch?${window.location.search.substring(1)}`;
    }
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

