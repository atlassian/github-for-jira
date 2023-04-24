$(".selectTable__addNew").click(function (event) {
  event.preventDefault();
  const customData = $(event.target).data("qs-for-path");

  AP.navigator.go("addonmodule", {
    moduleKey: $(event.target).data("path"),
    customData: customData  || null
  });
});
