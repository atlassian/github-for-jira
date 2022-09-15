
$(document).ready(() => {
  // Fetching the list of default repos
  const defaultRepos = $(".default-repos").map((_, option) => ({
    id: $(option).html(),
    text: $(option).html()
  })).toArray();

  $("#ghServers").auiSelect2();

  $("#ghRepo").auiSelect2({
    placeholder: "Select a repository",
    data: defaultRepos,
    query: options => {
      const userInput = options.term;
      let filteredRepos = defaultRepos.filter(repo => repo.id.toUpperCase().indexOf(userInput.toUpperCase()) >= 0);
      // TODO: Ajax Request to pull new repos and add them to the list, ARC-1600
      options.callback({ results: filteredRepos });
    }
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
    createBranchPost();
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
        formatResult: item => item.node.name
      });
      $("#ghParentBranch").select2("val", data.repository.defaultBranchRef.name);
      toggleSubmitDisabled(false);
    },
    error: (error) => {
      console.log(error);
      showErrorMessage("Failed to fetch branches");
      toggleSubmitDisabled(false);
    }
  });
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
    .fail((err) => {
      toggleSubmitDisabled(false);
      showErrorMessage("Please make sure all the details you entered are correct.")
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
const hideErrorMessage = (msg) => {
  $(".gitHubCreateBranch__serverError").hide();
};

const clearBranches = () => {
  $("#ghParentBranch").auiSelect2({ data: [] });
};