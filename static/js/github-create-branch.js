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

  $("#ghParentBranch").auiSelect2({
    placeholder: "Select a branch",
    data: []
  });

  $("#ghRepo").on("change", () => {
    loadBranches();
  });

  $("#createBranchForm").on("aui-valid-submit", (event) => {
    event.preventDefault();
    if (validateForm()) {
      createBranchPost();
    }
  });

  $('#cancelBtn').click(function (event) {
    event.preventDefault();
    window.close();
  });

});

const loadBranches = () => {
  clearBranches();
  toggleSubmitDisabled(true);
  hideErrorMessage();
  const repo = getRepoDetails();
  $.ajax({
    type: "GET",
    url: `/github/create-branch/owners/${repo.owner}/repos/${repo.name}/branches`,
    success: (data) => {
      const allBranchesfetched = data?.repository?.refs?.totalCount === data?.repository?.refs?.edges.length;
      $("#ghParentBranch").auiSelect2({
        data: () => {
          data.repository.refs.edges.forEach((item) => {
            item.id = item.node.name;
          });
          return {
            text: item => item.node.name,
            results: data.repository.refs.edges
          }
        },
        formatSelection: item => item.node.name,
        formatResult: item => item.node.name,
        createSearchChoice: (term) => {
          if (allBranchesfetched) {
            return null;
          }
          return {
            node: { name: term },
            id: term
          }
        }
      });
      $("#ghParentBranch").select2("val", data.repository.defaultBranchRef.name);
      toggleSubmitDisabled(false);
    },
    error: (error) => {
      showErrorMessage("Failed to fetch branches");
      toggleSubmitDisabled(false);
    }
  });
};

const validateForm = () => {
  let validated = true;
  if (!$("#ghRepo").select2("val")) {
    showValidationErrorMessage("ghRepo", "This field is required.");
    validated = false;
  }
  if (!$("#ghParentBranch").select2("val")) {
    showValidationErrorMessage("ghParentBranch", "This field is required.");
    validated =  false;
  }
  return validated;
};

const showValidationErrorMessage = (id, message) => {
  const DOM = $(`#s2id_${id}`);
  DOM.find("a.select2-choice").addClass("has-errors");
  DOM.append(`<div class="error-message"><i class="aui-icon aui-iconfont-error"></i>${message}</div>`);
};

const createBranchPost = () => {
  const url = "/github/create-branch";
  const repo = getRepoDetails();
  const data = {
    owner: repo.owner,
    repo: repo.name,
    sourceBranchName: $("#ghParentBranch").select2('val'),
    newBranchName: $('#branchNameText').val(),
    _csrf: $('#_csrf').val(),
  };
  toggleSubmitDisabled(true);
  hideErrorMessage();

  $.post(url, data)
    .done(() => {
      // On success, we close the tab so the user returns to original screen
      window.close();
    })
    .fail((error) => {
      toggleSubmitDisabled(false);
      if (error.responseJSON && error.responseJSON.err) {
        showErrorMessage(error.responseJSON.err);
      } else {
        showErrorMessage("Please make sure all the details you entered are correct.")
      }
    });
}

const toggleSubmitDisabled = (bool) => {
  $("#createBranchBtn").prop("disabled", bool);
  $("#createBranchBtn").attr("aria-disabled", String(bool));
}

const getRepoDetails = () => {
  const repoWithOwner = $("#ghRepo").select2('val').split('/');
  return {
    owner: repoWithOwner[0],
    name: repoWithOwner[1],
  }
};

const showErrorMessage = (msg) => {
  $(".gitHubCreateBranch__serverError").show();
  $(".errorMessageBox__message")
    .empty()
    .append(msg);
};

const hideErrorMessage = () => {
  $(".has-errors").removeClass("has-errors");
  $(".error-message").remove();
  $(".gitHubCreateBranch__serverError").hide();
};

const clearBranches = () => {
  $("#ghParentBranch").auiSelect2({ data: [] });
};

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
