$("#jiraManualAppCreation__form").submit((event) => {
  event.preventDefault();

  // TODO: Form submission
});

$(".jiraManualAppCreation__formFileInput")
  .on("dragenter focus", () => {
    $(".jiraManualAppCreation__formFileDropArea").addClass("active");
  }).on("dragleave blur drop", () => {
    $(".jiraManualAppCreation__formFileDropArea").removeClass("active");
  }).on("change", (event) => {
    const fileName = event.target.files[0].name;

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