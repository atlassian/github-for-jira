$(document).ready(() => {
  $("#ghServers").auiSelect2({
    dropdownCssClass: "aui-select2-dropdown-server"
  });
  $("#ghRepo").auiSelect2({
    dropdownCssClass: "aui-select2-dropdown-repo"
  });
  $("#ghParentBranch").auiSelect2({
    dropdownCssClass: "aui-select2-dropdown-parent-branch"
  });
}).on('keyup', '.select2-input', debounce(event => {
  const parentContainer = $(event.target).parent().parent();
  const userInput = event.target.value;

  if (userInput) {
    if (parentContainer.hasClass("aui-select2-dropdown-server")) {
      // TODO: Query to search for the server instance based on the input
    } else if (parentContainer.hasClass("aui-select2-dropdown-repo")) {
      // TODO: Query to search for the repo based on the input(ARC-1600)
    } else {
      // TODO: Query to search for the parent branch based on the input
    }
  }
}));

  $('#cancelBtn').click(function (event) {
	event.preventDefault();
	window.close();
});
