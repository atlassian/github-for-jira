const createBranchPost = () => {
	const url = "/github/create-branch";
	// Todo improve this select2 get and split once we have real data coming in
	const repoWithOwner = $("#ghRepo").select2('data').text.split(' / ');
	const data = {
		owner: repoWithOwner[0],
		repo: repoWithOwner[1],
		sourceBranchName: document.getElementById('ghParentBranch').value,
		newBranchName: document.getElementById('branchNameText').value,
		_csrf: document.getElementById('_csrf').value,
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
  $("#ghServers").auiSelect2();
  $("#ghRepo").auiSelect2();
  $("#ghParentBranch").auiSelect2();

	$("#createBranchForm").on("aui-valid-submit", (event) => {
		event.preventDefault();
		createBranchPost();
	});
});

$('#cancelBtn').click(function (event) {
	event.preventDefault();
	window.close();
});
