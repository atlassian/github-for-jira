$(".jiraManualAppCreation__formGroupIcon").click((event) => {
  const url = $(event.target).prev().val();
  // TODO: Enable iFrame Permissions and copy this URL to clipboard
  console.log("Copy this URL: ", url);
});

$("#jiraManualAppCreation__form").submit((event) => {
  event.preventDefault();
  console.log("Submit this");
});


$(".jiraManualAppCreation__formFileInput")
  .on("dragenter focus", () => {
    $(".jiraManualAppCreation__formFileDropArea").addClass("active");
  }).on("dragleave blur drop", () => {
    $(".jiraManualAppCreation__formFileDropArea").removeClass("active");
  }).on("change", (event) => {
    const fileName = $(event.target).val().split('\\').pop();

    $(".jiraManualAppCreation__formFileUploaded").css('display', 'flex');
    $(".jiraManualAppCreation__formFileDropArea").hide();
    $("#jiraManualAppCreation__uploadedFile").text(fileName);

  //  TODO: Validation and/or Upload
  });


$("#jiraManualAppCreation__clearUploadedFile").click(() => {
  $("#jiraManualAppCreation__uploadedFile").text("");
  $(".jiraManualAppCreation__formFileInput").val(null);
  $(".jiraManualAppCreation__formFileDropArea").show();
  $(".jiraManualAppCreation__formFileUploaded").hide();
});