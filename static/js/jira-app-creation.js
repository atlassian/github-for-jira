/* globals $, AP */
const params = new URLSearchParams(window.location.search.substring(1));
const jiraHost = params.get("xdm_e");

function openChildWindow(url) {
	const child = window.open(url);
	const interval = setInterval(function () {
		if (child.closed) {
			clearInterval(interval);
			AP.navigator.reload();
		}
	}, 100);

	return child;
}

$(document).ready(function () {

	let selectedOption;
	$(".optionsCard").click(function (event) {
		event.preventDefault();
		const currentTarget = $(event.currentTarget);
		$(".optionsCard").removeClass("selected");
		currentTarget.addClass("selected");
		$(".optionBtn").prop("disabled", false).attr("aria-disabled", "false").addClass("aui-button-primary");

		selectedOption = currentTarget.data('type');
	});

	$(".optionBtn").click(function (event) {
		event.preventDefault();
		 if(selectedOption === "automatic") {
			AP.context.getToken(function(token) {
				const child = openChildWindow("/session/github/redirect");
				child.window.jiraHost = jiraHost;
				child.window.jwt = token;
			});
		} 
	});
});
