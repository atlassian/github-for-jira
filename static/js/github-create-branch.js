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
	// Fetching the list of default repos
	const defaultRepos = $(".default-repos").map((_, option) => ({
		id: $(option).html(),
		text: $(option).html()
	})).toArray();

  $("#ghServers").auiSelect2();

  $("#ghRepo").auiSelect2({
		placeholder: "Select a repository",
		data: defaultRepos,
		_ajaxQuery: Select2.query.ajax({
			dataType: "json",
			quietMillis: 500,
			url: "/github/repository",
			data: term => ({
				repoName: term
			}),
			results: (response) => {
				const { repositories } = response;
				return  {
					results: repositories.map(repository => ({
						id: repository.repo.nameWithOwner,
						text: repository.repo.nameWithOwner
					}))
				}
			},
		}),
		query: function(options) {
			const userInput = options.term;
			let filteredRepos = defaultRepos.filter(repo => repo.id.toUpperCase().indexOf(userInput.toUpperCase()) >= 0);
			if (userInput.length) {
				this._ajaxQuery.call(this, options);
			}
			options.callback({ results: filteredRepos });
		}
	});

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
