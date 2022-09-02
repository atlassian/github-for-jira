$(document).ready(() => {
  $("#ghServers").auiSelect2();
  $("#ghRepo").auiSelect2();
  $("#ghParentBranch").auiSelect2();
});

$('#cancelBtn').click(function (event) {
	event.preventDefault();

	window.close();
});
