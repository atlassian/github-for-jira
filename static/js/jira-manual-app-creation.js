$("#jiraManualAppCreation__form").submit(() => {
  // TODO: Form submission
  console.log("Submit Form");
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