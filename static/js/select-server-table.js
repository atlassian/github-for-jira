$(".selectServer__addNew").click(function (event) {
  event.preventDefault();
  AP.navigator.go("addonmodule", {moduleKey: $(event.target).data("path")});
});
