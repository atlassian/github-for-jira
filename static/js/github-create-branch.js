$(document).ready(() => {
  $("#ghServers").auiSelect2();
  $("#ghRepo").auiSelect2();
  $("#ghParentBranch").auiSelect2();

  $(".gitHubCreateBranch__option").on("click", event => {
    event.preventDefault();
    $(".gitHubCreateBranch__option").removeClass("gitHubCreateBranch__selected");
    $(event.target).addClass("gitHubCreateBranch__selected");
  });
});


