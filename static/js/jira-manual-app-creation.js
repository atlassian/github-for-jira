/* globals $, AP */
const params = new URLSearchParams(window.location.search.substring(1));
const jiraHost = params.get("xdm_e");

const isUpdatePage = () => {
	const update = document.getElementById("Update");
	return update && update.innerText === "Update";
};

const isCreatePage = () => {
	return !isUpdatePage();
};

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

const handleFormErrors = () => {
	$(".jiraManualAppCreation__serverError").show();
	$(".errorMessageBox__message")
		.empty()
		.append("Please make sure all the details you entered are correct.")
		.append(
			'<div class="jiraManualAppCreation__serverError__linkContainer">' +
			'	<a href="https://support.atlassian.com/jira-cloud-administration/docs/manually-create-a-github-app" target="_blank">Learn more</a>' +
			'</div>'
		);
	const errorTitle = ".errorMessageBox__title";

	$(errorTitle).empty().append(isUpdatePage()
		? "We couldn't update your GitHub app."
		: "We couldn't create your GitHub app."
	);
}

const gitHubAppPutRequest = (uuid, data) => {
	$.ajax({
		type: "PUT",
		url: `/jira/connect/enterprise/app/${uuid}`,
		data,
		success: AP.history.back,
		error: handleFormErrors
	});
};

const gitHubAppPostRequest = (data) => {
	$.ajax({
		type: "POST",
		url: `/jira/connect/enterprise/app`,
		data,
		success: function() {
			const child = openChildWindow(`/session/github/${response.data.uuid}/configuration?ghRedirect=to`);
			child.window.jiraHost = jiraHost;
			child.window.jwt = token;
		},
		error: handleFormErrors
	});
};

$(document).ready(function() {
	// Display the filename and make the data valid so users don't need to upload their pem file every time
	if (isUpdatePage()) {
		$(".jiraManualAppCreation__formNoFileUploaded").hide();
		$(".jiraManualAppCreation__formFileUploaded").css('display', 'flex');
		$("#privateKeyFile").attr("data-aui-validation-state", "valid").removeAttr("required");
	}

	AJS.$("#jiraManualAppCreation__form").on("aui-valid-submit", (event) => {
		event.preventDefault();
		const form = event.target;
		const data = $(form).serializeObject();
		const uuid = $(event.target).data("app-uuid");
		const appName = $(event.target).data("app-appname");
		const renderedFilename = document.getElementById("jiraManualAppCreation__uploadedFile").innerText;
		const isFileChanged = renderedFilename !== `${appName}.private-key.pem`;

		if (isFileChanged || isCreatePage()) {
			const file = $("#privateKeyFile")[0].files[0];
			const reader = new FileReader();
			reader.readAsText(file);

			reader.onload = () => {
				data.privateKey = reader.result;
			};
		}

		AP.context.getToken((token) => {
			data.jwt = token;
			data.jiraHost = jiraHost;

			if (isUpdatePage()) {
				gitHubAppPutRequest(uuid, data);
			} else {
				gitHubAppPostRequest(data);
			}
		});
	});

	const replaceSpacesAndChangeCasing = (str) => str.replace(/\s+/g, '-').toLowerCase();

	$('#jiraManualAppCreation__uploadedFile').bind('DOMSubtreeModified', function () {
		const fileName = document.getElementById("jiraManualAppCreation__uploadedFile").innerText;
		// value used when user is updating up and app name already exists
		const appNameFromData = $(this).data("app-appname");
		// value used when creating an app and user has entered a value in gitHubAppName
		const appNameFromInput = $("input[name=gitHubAppName]").val();
		// value used when creating an app but user has not entered a value in gitHubAppName
		const unknownAppName = "< github-app-name >"; // needs spacing other AJS.flag omits the text and treats this as a HTML element

		const appName = replaceSpacesAndChangeCasing(appNameFromData)
			|| replaceSpacesAndChangeCasing(appNameFromInput)
			|| unknownAppName;
		const body = `
				<p class="jiraManualAppCreation__flag__title"><strong>Your file has been uploaded</strong></p>
				<p>Your file has been uploaded and will be </br>
				stored with the filename in the format of </br>
				${appName}.private-key.pem</p>
		`;
		const pemFilePattern = "^.*\.(pem|PEM)$";

		if (fileName !== "" && fileName.match(pemFilePattern)) {
			AJS.flag({
				type: "success",
				body
			});
		}
	});

	$('#jiraManualAppCreation__clearUploadedFile').click(function (event) {
		event.preventDefault();
		$("#privateKeyFile").attr("data-aui-validation-state", "unvalidated").attr("required", true)
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
		$(".jiraManualAppCreation__formFileInput").attr("data-aui-validation-state", "unvalidated");
		$(".jiraManualAppCreation__formFileDropArea .error").remove();
	});
});
