/* globals $, AP */

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

		console.log("selectedOption", selectedOption);
		 if(selectedOption === "automatic") {
			$.ajax({
				type: "GET",
				url: "/jira/manifest",
				success: function(appManifest) {
					console.log(JSON.stringify(appManifest));

					const newForm = jQuery('<form>', {
						'action': 'http://github.internal.atlassian.com/settings/apps/new', // Todo: read from query param
						'method': 'post',
						'target': '_blank'
				}).append(jQuery('<input>', {
						'name': 'manifest',
						'id': 'manifest',
						'value': JSON.stringify(appManifest),
						'type': 'text'
				}));
				$(document.body).append(newForm);
				newForm.submit(); 
				}
			});
		} 
	});
});
