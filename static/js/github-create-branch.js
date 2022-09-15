let queriedRepos = [];
let totalRepos = [];

$(document).ready(() => {
  // Fetching the list of default repos
  totalRepos = $(".default-repos").map((_, option) => ({
    id: $(option).html(),
    text: $(option).html()
  })).toArray();

  $("#ghServers").auiSelect2();

  $("#ghRepo").auiSelect2({
    placeholder: "Select a repository",
    data: totalRepos,
    dropdownCssClass: "ghRepo-dropdown",
    _ajaxQuery: Select2.query.ajax({
      dataType: "json",
      quietMillis: 500,
      url: "/github/repository",
      data: term => ({
        repoName: term
      }),
      results: function (response) {
        const { repositories } = response;
        repositories.forEach(repository => {
          if (queriedRepos.filter(repo => repo.id === repository.repo.nameWithOwner).length < 1) {
            const additionalRepo = {
              id: repository.repo.nameWithOwner,
              text: repository.repo.nameWithOwner
            };
            queriedRepos.unshift(additionalRepo);
            totalRepos.unshift(additionalRepo);
          }
        });
        toggleLoaderInInput($(".ghRepo-dropdown"), false);
        return {
          results: queriedRepos
        }
      }
    }),
    query: function (options) {
      const userInput = options.term;
      queriedRepos = totalRepos.filter(repo => repo.id.toUpperCase().indexOf(userInput.toUpperCase()) >= 0);
      if (userInput.length) {
        toggleLoaderInInput($(".ghRepo-dropdown"), true);
        this._ajaxQuery.call(this, options);
      }
      options.callback({ results: queriedRepos });
    }
  })
    .on("select2-close", () => {
      toggleLoaderInInput($(".ghRepo-dropdown"), false);
    });

  $("#ghParentBranch").auiSelect2();

  $("#createBranchForm").on("aui-valid-submit", (event) => {
    event.preventDefault();
    createBranchPost();
  });
});

const toggleLoaderInInput = (inputDOM, state) => {
  const container = inputDOM.find("div.select2-search");
  const loader = ".select2-loader";
  if (state) {
    if (!container.find(loader).length) {
      container.prepend(`<aui-spinner size="small" class="select2-loader"></aui-spinner>`);
    }
  } else {
    container.find(loader).remove();
  }
};

const createBranchPost = () => {
  const url = "/github/create-branch";
  // Todo improve this select2 get and split once we have real data coming in
  const repoWithOwner = $("#ghRepo").select2("data").text.split("/");
  const data = {
    owner: repoWithOwner[0],
    repo: repoWithOwner[1],
    sourceBranchName: $("#ghParentBranch").select2("data").text,
    newBranchName: $("#branchNameText").val(),
    _csrf: $("#_csrf").val(),
  };
  toggleSubmitDisabled(true);

  $.post(url, data)
    .done(() => {
      // On success, we close the tab so the user returns to original screen
      window.close();
    })
    .fail((err) => {
      toggleSubmitDisabled(false);
      $(".gitHubCreateBranch__serverError").show();
      $(".errorMessageBox__message")
        .empty()
        .append("Please make sure all the details you entered are correct.")
    });
}

const toggleSubmitDisabled = (bool) => {
  $("#createBranchBtn").prop("disabled", bool);
  $("#createBranchBtn").attr("aria-disabled", String(bool));
}

$('#cancelBtn').click(function (event) {
	event.preventDefault();
	window.close();
});
