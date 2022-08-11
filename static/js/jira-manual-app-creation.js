/* globals $, AP */
const params = new URLSearchParams(window.location.search.substring(1));
const jiraHost = params.get("xdm_e");

const openChildWindow = (url) => {
	const child = window.open(url);
	const interval = setInterval(function () {
		if (child.closed) {
			clearInterval(interval);
			AP.navigator.go(
				'addonmodule',
				{
					moduleKey: "github-post-install-page"
				}
			);
		}
	}, 1000);

	return child;
}

const handleFormErrors = (isUpdate) => {
	$(".jiraManualAppCreation__serverError").show();
	$(".errorMessageBox__message").empty().append("Please make sure all the details you entered are correct.");
	const errorTitle = ".errorMessageBox__title";

	isUpdate
		? $(errorTitle).empty().append("We couldn't update your GitHub app.")
		: $(errorTitle).empty().append("We couldn't create your GitHub app.");
}

const gitHubAppPutRequest = (uuid, isUpdate) => {
	$.ajax({
		type: "PUT",
		url: `/jira/connect/enterprise/app/${uuid}`,
		data,
		success: function (response) {
			if (response.success) {
				AP.history.back();
			} else {
				handleFormErrors(isUpdate);
			}
		}
	});
}

AJS.$("#jiraManualAppCreation__form").on("aui-valid-submit", (event) => {
	event.preventDefault();
	const form = event.target;
	const data = $(form).serializeObject();
	const isUpdate = document.getElementById("Update").innerText === "Update";
	const uuid = $(event.target).data("app-uuid");

	AP.context.getToken((token) => {
		data.jwt = token;
		data.jiraHost = jiraHost;

		// need isUpdate && fileChanged
		if (isUpdate) {
			const file = $("#privateKeyFile")[0].files[0];
			const reader = new FileReader();
			reader.readAsDataURL(file);

			reader.onload = () => {
				data.privateKey = reader.result;
				console.log("in here")
				gitHubAppPutRequest(uuid, isUpdate)
			};
		} else {
			$.post("/jira/connect/enterprise/app", data, (response, _status, result) => {
				if (response.success) {
					// TODO: This doesn't work, will be done in ARC-1565
					const child = openChildWindow(`/session/github/${response.data.uuid}/configuration?ghRedirect=to`);
					child.window.jiraHost = jiraHost;
					child.window.jwt = token;
				} else {
					handleFormErrors(isUpdate);
				}
			});
		}
	});
});

$(".jiraManualAppCreation__formFileInput")
	.on("dragenter click", () => {
		$(".jiraManualAppCreation__formFileDropArea").addClass("active");
	}).on("dragleave blur drop", () => {
	$(".jiraManualAppCreation__formFileDropArea").removeClass("active");
}).on("change", (event) => {
	const fileName = event.target.files[0].name;

	$(".jiraManualAppCreation__formFileUploaded").css('display', 'flex');
	$(".jiraManualAppCreation__formNoFileUploaded").hide();
	$("#jiraManualAppCreation__uploadedFile").text(fileName);
});

$("#jiraManualAppCreation__clearUploadedFile").click(() => {
	$("#jiraManualAppCreation__uploadedFile").text("");
	$(".jiraManualAppCreation__formNoFileUploaded").show();
	$(".jiraManualAppCreation__formFileUploaded").hide();

	// Resetting the input field and its errors
	$(".jiraManualAppCreation__formFileInput").val(null)
		.attr("data-aui-validation-state", "unvalidated");
	$(".jiraManualAppCreation__formFileDropArea .error").remove();
});

$( document ).ready(function() {
	const isUpdate = document.getElementById("Update").innerText === "Update";

	if (isUpdate) {
		$(".jiraManualAppCreation__formNoFileUploaded").hide();
		$(".jiraManualAppCreation__formFileUploaded").css('display', 'flex');
		$("#privateKeyFile").attr("data-aui-validation-state", "valid");



	}

});
