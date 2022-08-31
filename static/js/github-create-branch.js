
$(document).ready(() => {
	setupSelectFields();

	$('.gitHubCreateBranch__option').click(function (event) {
		event.preventDefault();
		$('.gitHubCreateBranch__option').removeClass('gitHubCreateBranch__selected');
		$(event.target).addClass('gitHubCreateBranch__selected');
	});
});

const setupSelectFields = () => {
	const options = {
		formatNoMatches: () => "<a href='#'>Can't find the repository you're looking for?</a>"
	};
	AJS.$("#gitHubRepos").auiSelect2(options);
	AJS.$("#gitHubBranches").auiSelect2(options);
};
