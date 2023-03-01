$(".page-selector").click(function (event) {
	const subscriptionId = $(event.target.parentElement).attr('data-subscription-id');
	const pageNumber = $(event.target).attr('data-page-num');

	AP.context.getToken(function (token) {
		window.location.href = `/jira/subscription/${subscriptionId}/repos?jwt=${token}&page=${pageNumber}`;
	});
});
