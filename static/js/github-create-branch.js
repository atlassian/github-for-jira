const createBranchPost = () => {
	// Todo disable submit button
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

	$("#createBranchBtn").prop("disabled", true);
	$("#createBranchBtn").attr("aria-disabled", "true");

	$.post(url, data)
		.done(() => {
			// On success, we close the tab so the user returns to original screen
			window.close();
		})
		.fail((err) => {
			// TODO - RESPOND WITH APPROPRIATE FAILURE MESSAGING!
			$("#createBranchBtn").prop("disabled", false);
			$("#createBranchBtn").attr("aria-disabled", "false");
			console.log(err);
		});
}

$(document).ready(() => {
  $("#ghServers").auiSelect2();
  $("#ghRepo").auiSelect2();
  $("#ghParentBranch").auiSelect2();

	$("#createBranchForm").on("submit", (event) => {
		event.preventDefault();
		createBranchPost();
	});
});

$('#cancelBtn').click(function (event) {
	event.preventDefault();

	window.close();
});
