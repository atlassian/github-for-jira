const createBranchPost = () => {
	const url = "/github/create-branch";
	// Todo improve this select2 get and split once we have real data coming in
	const repoWithOwner = $("#ghRepo").select2('data').text.split('/');
	const data = {
		owner: repoWithOwner[0],
		repo: repoWithOwner[1],
		sourceBranchName: $("#ghParentBranch").select2('data').text,
		newBranchName: $('#branchNameText').val(),
		_csrf: $('#_csrf').val(),
	};
	toggleSubmitDisabled(true);

	$.post(url, data)
		.done(() => {
			// On success, we close the tab so the user returns to original screen
			window.close();
		})
		.fail((err) => {
			toggleSubmitDisabled(false);
			$(".gitHubCreateBranch__serverError").show();
			$(".errorMessageBox__message")
				.empty()
				.append("Please make sure all the details you entered are correct.")
		});
}

const toggleSubmitDisabled = (bool) => {
	$("#createBranchBtn").prop("disabled", bool);
	$("#createBranchBtn").attr("aria-disabled", String(bool));
}

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

	$("#createBranchForm").on("aui-valid-submit", (event) => {
		event.preventDefault();
		createBranchPost();
	});
}).on('keyup', '.select2-input', debounce(event => {
  const parentContainer = $(event.target).parent().parent();
  const userInput = event.target.value;

  if (userInput) {
    if (parentContainer.hasClass("aui-select2-dropdown-server")) {
      // TODO: Query to search for the server instance based on the input
    } else if (parentContainer.hasClass("aui-select2-dropdown-repo")) {
			$.ajax({
				type: "GET",
				url: "/github/repository?repoName=" + userInput,
				success: (response) => {
					const { respositories } = response;
					console.log("respositories: ", respositories);
				}
			})
    } else {
      // TODO: Query to search for the parent branch based on the input
    }
  }
}));

  $('#cancelBtn').click(function (event) {
	event.preventDefault();
	window.close();
});
