$('.gitHubCreateBranch__option').click(function (event) {
	event.preventDefault();
	$('.gitHubCreateBranch__option').removeClass('gitHubCreateBranch__selected');
	$(event.target).addClass('gitHubCreateBranch__selected');
});