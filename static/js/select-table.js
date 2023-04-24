$(".selectTable__addNew").click(function (event) {
  event.preventDefault();
  const queryString = $(event.target).data("qs-for-path");

  AP.navigator.go("addonmodule", {
    moduleKey: $(event.target).data("path"),
    customData: queryString  ? JSON.parse(queryString) : null
  });
});
