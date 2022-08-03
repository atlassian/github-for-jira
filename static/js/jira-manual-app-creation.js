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

AJS.$("#jiraManualAppCreation__form").on("aui-valid-submit", (event) => {
  event.preventDefault();
  const form = event.target;
  const csrf = $("#_csrf").val();
  const data = $(form).serializeObject();
  const isUpdate = $('input[type=submit]').val() === "Update";

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
        // TODO: Do a put request to update the existing app
      } else {
         $.post("/jira/connect/enterprise/app", data, (response, _status, result) => {
          if (result.status === 201) {
            // TODO: Change this url to `/session/enterprise/github/configuration` once ARC-1552 is merged
            const child = openChildWindow(`/session/github/${response.data.uuid}/configuration/`);
            child.window.jiraHost = jiraHost;
            child.window.jwt = token;
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