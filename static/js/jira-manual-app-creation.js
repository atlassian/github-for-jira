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
	isUpdate
		? $(".errorMessageBox__title").empty().append("We couldn't update your GitHub app.")
		: $(".errorMessageBox__title").empty().append("We couldn't create your GitHub app.");
}


AJS.$("#jiraManualAppCreation__form").on("aui-valid-submit", (event) => {
  event.preventDefault();
  const form = event.target;
  const csrf = $("#_csrf").val();
  const data = $(form).serializeObject();
  const isUpdate = $('input[type=submit]').val() === "Update";
	const uuid = $(event.target).data("app-uuid");

  // Reading the content of the file
  const file = $("#privateKeyFile")[0].files[0];
  const reader = new FileReader();
  reader.readAsDataURL(file);

  reader.onload = () => {
    data.privateKey = reader.result;

    AP.context.getToken((token) => {
      data.jwt = token;
      data._csrf = csrf;
      data.jiraHost = jiraHost;

      if (isUpdate) {
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
  };
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
