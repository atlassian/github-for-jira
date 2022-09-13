$(document).ready(() => {
  $("#ghServers").auiSelect2({
    dropdownCssClass: "aui-select2-dropdown-server"
  });
  $("#ghRepo").auiSelect2({
    dropdownCssClass: "aui-select2-dropdown-repo",
		/**
		 * On every key up event, an Ajax request is hit,
		 * during which the dropdown shows the default message `No matches found`.
		 * So, replaced the default message to Searching(loading),
		 * and when the Ajax request is completed, replacing this Searching(loading) text back to the `No matches found` message
		 */
		formatNoMatches: () => "Searching..."
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
			const auiSelect2 = $("#ghRepo");
			$.ajax({
				type: "GET",
				url: "/github/repository?repoName=" + userInput,
				success: (response) => {
					const { repositories } = response;
					const cachedRepos = $("#ghRepo option").map((_, option) => $(option).val()).toArray();

					repositories.map( repository => {
						const repo = repository.repo;
						if (!cachedRepos.includes(repo.nameWithOwner)) {
							// Adding the new repos into the list
							auiSelect2.prepend(`<option value="${repo.nameWithOwner}">${repo.nameWithOwner}</option>`);
							auiSelect2.trigger("change");
							// Re-opening the select(it closes after triggering change), and adding the user's input back in the input
							auiSelect2.auiSelect2("open");
							auiSelect2.auiSelect2("search", userInput);
						}
					});
				},
				complete: () => {
					updateMessageToNoResultsFound();
				}
			});
    } else {
      // TODO: Query to search for the parent branch based on the input
    }
  }
}));

/**
 * This method replaces the Searching(loading) text back to `No matches found`
 */
const updateMessageToNoResultsFound = () => {
	$(".select2-no-results").text("No matches found");
};

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

$('#cancelBtn').click(function (event) {
	event.preventDefault();
	window.close();
});
