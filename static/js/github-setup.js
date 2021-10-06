$(".connect-new-instance").click(function (event) {
	event.preventDefault();

	document.getElementById("jira-instance-form").className =
		"githubSetup__form__true";
});
