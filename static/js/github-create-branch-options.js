$(document).ready(() => {

  $("#ghServers").auiSelect2();

  $(".gitHubCreateBranchOptions__option").click((event) => {
    event.preventDefault();
    ghServerOptionHandler(event);
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

