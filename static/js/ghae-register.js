$('.ghae-register-link').click((event) => {
  event.preventDefault();
  let ghaeUrl = document.getElementById('ghae_url_id').value;
  if(ghaeUrl == ''){
    document.getElementById("errormessage").innerHTML = `please enter a valid url.`;
    return false;
  }
  if(!validateGhaeUrl(ghaeUrl)){
    document.getElementById("errormessage").innerHTML = `"${ghaeUrl}" is not a valid GitHuB AE account url, please enter a valid url.`;
    return false;
  }

  let ghaeInstanceHost = new URL(ghaeUrl).hostname;
  $.ajax({
    type: 'POST',
    url: `/register?ghaeHost=${encodeURIComponent(ghaeInstanceHost)}`,
    success(data) {
      let ghaeInstance = `https://${ghaeInstanceHost}/settings/apps/new?state=${data.state}`;
      document.getElementById('ghae_form_id').action = ghaeInstance;
      document.getElementById('manifest').value = data.manifest;
      document.getElementById('ghae_form_id').submit();
    },
    error(error) {
      document.getElementById("errormessage").innerHTML = error.responseJSON.err;
      console.log(error)
    }
  });
});

function validateGhaeUrl(url) {
  if(url.indexOf("http://") == 0 || url.indexOf("https://") == 0){
      return true;
  }
  return false; 
}
