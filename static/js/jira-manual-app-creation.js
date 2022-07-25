AJS.$("#jiraManualAppCreation__form").on("aui-valid-submit", (event) => {
  event.preventDefault();
  const form = event.target;
  const csrf = $("#_csrf").val();
  const data = $(form).serializeObject();

  // Reading the content of the file
  const file = $("#privateKeyFile")[0].files[0];
  const reader = new FileReader();
  reader.readAsDataURL(file);

  reader.onload = () => {
    data.privateKey = reader.result;

    AP.context.getToken((token) => {
      data.jwt = token;
      data._csrf = csrf;
      data.jiraHost = $("#gitHubBaseUrl").val();

      $.post("/jira/connect/enterprise/app", data, (_message, _status, response) => {
        if (response.status === 201) {
          // TODO: Redirect to the App connection
        }
      });
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