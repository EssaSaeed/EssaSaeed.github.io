//AniList API OAuth2 prerequisites
var YOUR_CLIENT_ID = 'essasaeed-wiio4';
var YOUR_CLIENT_SECRET = 'swiaszULkKiZFuw1Ux9feLi0Q';
var YOUR_REDIRECT_URI = 'https://anilist.co/';

//Temporarily holds user's 'current' anime Liked/Disliked data until screen change then commits to LocalStorage
var dataToStore;
var analytics;
var isAnimeFlaggedAsLiked = null;

var animeDataToAddToWatchlist = {"animeIsLiked": null, "id": null, "title": null, "genres": null, "icon_url": null};

//Global screen stack
var screen_stack = [];

var access_token;
var callDefaultGetAnime = true;
var sonarOn = false;

function IsJsonString(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

function checkIfAnimeShouldBeShown(animeModel) {
  // check for genres to not show, ensuring this is a safe app for all users of all ages
  for (var j=0; j<animeModel.genres.length; j++) {    // this is the same as an array.find() but .find() is es6 and not supported on <= Android4
    if (animeModel.genres[j] === "Ecchi" || animeModel.genres[j] === "Hentai") {
      //if adult content, don't show
      return false;
    }
  }

  if (animeModel.adult === true) {
    //if 'adult' anime, do not show
    return false;
  }

  // if (animeData[i].total_episodes === 1 && animeData[i].airing_status === "finished airing") {
  //   //if anime movie or just OVA then don't show it
  // }
  // if (animeModel.type == "Movie") {   // don't show movies, for now
  //   return false;
  // }

  return true;
}

function getParameterValueFromURL(param, url) {
  var queryPortionOfUrl = url.splice('?');
  var parametersString = queryPortionOfUrl[1];
  var parameters = parametersString.splice('&');
  for(var i=0; i<parameters.length; i++){
    if(parameters[i].indexOf(param) >= 0) {
      var paramAndValue = parameters[i].splice('=');
      var value = paramAndValue[1];
      return value;
    }
  }
  // console.log("Error: parameter not found in given url");
}

function doesArrayHaveItem(item, array) {
  for (var i=0; i<array.length; i++) {
    if (array[i] == item) {
      return false;
    }
  }
  return true;
}

function getHighestValuedGenresFromJSON(jsonData, numberOfTopValuedItemsToGet) {
  // If all values in JSON are 0 (implying nothing in watchlist -- show the 'help' DIV?)
  // so show that 'help' div/screen after returning "" for the resultant query?

  var topValuedItems = [];
  
  var arrayOfGenres = ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Mecha", "Music", "Mystery",
                    "Psychological", "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller"];
  
  for (var i=0; i<numberOfTopValuedItemsToGet; i++) {
    // keep track of the top item that is not already in the topValuedItems array for each loop iteration
    // at end of loop append/push it onto the end of the array

    var currentTopValuedItem = arrayOfGenres[i];
    for (var j=1; j<arrayOfGenres.length; j++) {
      if ( (jsonData[currentTopValuedItem] < jsonData[arrayOfGenres[j]]) && !(doesArrayHaveItem(arrayOfGenres[j], topValuedItems)) ) {
        currentTopValuedItem = arrayOfGenres[j];
      }
    }
    topValuedItems.push(currentTopValuedItem);
  }
  // format the array into one string and return
  return topValuedItems;
}

function convertStringifiedArrayToArray(string) {   // I thought this method was gonna be longer lol
  var array = string.split(',');
  return array;
}

function getDataFromStore(key) {
  var currentDataFromStore = localStorage.getItem(key);    // preventing JSON errors
    if (currentDataFromStore != undefined && currentDataFromStore != "undefined") {
      currentDataFromStore = JSON.parse(currentDataFromStore);
    }
    else {
      currentDataFromStore = null;
    }
    
    return currentDataFromStore;
}

function getAnalyticsFromStore(key) {
  var currentAnalytics = localStorage.getItem(key);
    if (currentAnalytics != undefined && currentAnalytics != "undefined") {
      currentAnalytics = JSON.parse(currentAnalytics);
    }
    else {
      currentAnalytics = null;
    }
    return currentAnalytics;
}

function addAnimeToWatchedListTemporarily(animeIsLiked, id, title, genres, icon_url) {
  animeDataToAddToWatchlist["animeIsLiked"] = animeIsLiked;
  isAnimeFlaggedAsLiked = animeIsLiked;
  animeDataToAddToWatchlist["id"] = id;
  animeDataToAddToWatchlist["title"] = title;
  animeDataToAddToWatchlist["genres"] = genres;
  animeDataToAddToWatchlist["icon_url"] = icon_url;
}

//[{"id":7,"genre":"Action"},{"id":9,"genre":"Adventure"},{"id":11,"genre":"Comedy"},{"id":17,"genre":"Drama"},{"id":19,"genre":"Ecchi"},{"id":20,"genre":"Fantasy"},{"id":24,"genre":"Hentai"},{"id":26,"genre":"Horror"},{"id":78,"genre":"Mahou Shoujo"},{"id":33,"genre":"Mecha"},{"id":36,"genre":"Music"},
//{"id":37,"genre":"Mystery"},{"id":41,"genre":"Psychological"},{"id":42,"genre":"Romance"},{"id":49,"genre":"Sci-Fi"},{"id":59,"genre":"Slice of Life"},
//{"id":65,"genre":"Sports"},{"id":70,"genre":"Supernatural"},{"id":72,"genre":"Thriller"}]
// the data will be stored as a JSON that will be made up of an array of JSONs
function addAnimeToWatchedList() {
  var animeIsLiked = animeDataToAddToWatchlist["animeIsLiked"];
  var id = animeDataToAddToWatchlist["id"];
  var title = animeDataToAddToWatchlist["title"];
  var genres = animeDataToAddToWatchlist["genres"];
  var icon_url = animeDataToAddToWatchlist["icon_url"];

  if (isAnimeFlaggedAsLiked != null) {
    // For some reason the genres Array gets turned into a string with commas between elements...
    // Convert that weird string into an array:
    genres = convertStringifiedArrayToArray(genres);

    // Flag to track whether the current 'liked' anime is a duplicate of something that is already in localstorage
    var isDuplicate = false;

    // Have two separate JSON lists/arrays, one for Liked and the other for Disliked?
    isAnimeFlaggedAsLiked = animeIsLiked;
    // we create a JSON representation of the new data
    var newDataObject = { "id": id, "title": title, "icon_url": icon_url };
    // fetch any existing JSON WatchedList data in LocalStorage, if any

    if (animeIsLiked) {
      // var currentDataFromStore = localStorage.getItem('watchlistLiked');    // preventing JSON errors
      // if (currentDataFromStore != undefined) {
      //   dataToStore = JSON.parse(currentDataFromStore);
      // }
      // else {
      //   dataToStore = null;
      // }
      dataToStore = getDataFromStore('watchlistLiked');
      
      // var currentAnalytics = localStorage.getItem('likedAnalytics');
      // if (currentAnalytics != undefined) {
      //   analytics = JSON.parse(currentAnalytics);
      // }
      // else {
      //   analytics = null;
      // }
      analytics = getAnalyticsFromStore('likedAnalytics');
    }
    else {  // Disliked
      dataToStore = getDataFromStore('watchlistDisliked');
      analytics = getAnalyticsFromStore('dislikedAnalytics');
    }

    // If first time using localStorage, then initialize the JSON data format for it
    if (dataToStore == null) {
      dataToStore = [];
    }
    else {
      // Do DUPLICATE CHECKING to prevent the same entry from being in the watchlist twice
      for (var i=0; i<dataToStore.length; i++) {
        if (dataToStore[i].id == id) {    // id that was passed in
          isDuplicate = true;
        }
      }
    }
    
    if (!isDuplicate) {
      if (analytics == null) {
        analytics = {"Action": 0, "Adventure": 0, "Comedy": 0, "Drama": 0, "Fantasy": 0, "Horror": 0, "Mecha": 0, "Music": 0, "Mystery": 0,
                      "Psychological": 0, "Romance": 0, "Sci-Fi": 0, "Slice of Life": 0, "Sports": 0, "Supernatural": 0, "Thriller": 0};
      }
      // append the new JSON data on the end of it
      dataToStore.push(newDataObject);
      dataToStore = JSON.stringify(dataToStore);
      // console.log("DataToStore: " + dataToStore);
      // store the stringified JSON with key = WatchedListData (or something) to LocalStorage

      // There are two special key-value pair in LocalStorage:
      // 1) key = likedAnalytics, and value is the count of each genre in the user's WatchedList that is flagged Liked
      // 2) key = dislikedAnalystics, and value is the count of each genre in the user's WatchedList that is flagged Disliked
      // These values will be 'dictionaries' so like: dict = {} like Python where the key=Genre and value=Count

      // Implementing the likedAnalytics first
      // first fetch the old likedAnalytics counts:
      
      // use genres to calculate the new values for the special key-value pairs
      for (var i=0; i<genres.length; i++) {   // an array of JSONs
        analytics[genres[i]] = analytics[genres[i]]+1;
      }
      analytics = JSON.stringify(analytics);
      // console.log("Analytics: " + analytics);
    }
  }

  if (isAnimeFlaggedAsLiked != null) {  // If it is still null, then the user has not specified whether they Like or Dislike the 'current' anime
    if (isAnimeFlaggedAsLiked) {
      localStorage.setItem('watchlistLiked', dataToStore);
      localStorage.setItem('likedAnalytics', analytics);
    }
    else {
      localStorage.setItem('watchlistDisliked', dataToStore);
      localStorage.setItem('dislikedAnalytics', analytics);
    }
    // reset the flag that lets us know a new Anime has been liked
    isAnimeFlaggedAsLiked = null;
  }
}

// // uses the temporarily stored Global variables to permanently update localStorage
// function addAnimeToWatchedListIfPossible() {
//   // set the updated data
//   if (isAnimeFlaggedAsLiked != null) {  // If it is still null, then the user has not specified whether they Like or Dislike the 'current' anime
//     if (isAnimeFlaggedAsLiked) {
//       localStorage.setItem('watchlistLiked', dataToStore);
//       localStorage.setItem('likedAnalytics', analytics);
//     }
//     else {
//       localStorage.setItem('watchlistDisliked', dataToStore);
//       localStorage.setItem('dislikedAnalytics', analytics);
//     }
//     // reset the flag that lets us know a new Anime has been liked
//     isAnimeFlaggedAsLiked = null;
//   }
// }

function clearScreenDivThroughRemoveChildren(name) {
  //name could be any id, we'll be using this for thumbnailDisplay and detailDisplay
  var divToBeCleared = document.getElementById(name);
  while (divToBeCleared.lastChild) {      // removing last child(s) seems to be fastest approach to removing all children nodes
    divToBeCleared.removeChild(divToBeCleared.lastChild);
  }
}

function switchScreens(screenType, query, exclusions) {
  // screenType to change TO, could be 'back', 'details', 'browse', 'watchlist', 'recommendations'
  // calls the appropriate methods to generate the correct screen, adds the created screen to top of 'screen stack'
  // 'back' pops off the screen at the top of the 'screen stack' and then shows the screen underneath

  // when we navigate AWAY from Browse or Details screens, we should CLEAR them
  var current_top_of_stack = screen_stack.pop();
  if ((current_top_of_stack == "browse" || current_top_of_stack == "recommendations") && (screenType == "browse" || screenType == "recommendations")) {
    clearScreenDivThroughRemoveChildren("thumbnail-display");   // ONLY DO THIS IF NAVIGATING AWAY FROM BROWSE/SEARCH/RECOMMENDATIONS TO ANOTHER BROWSE/SEARCH/RECOMMENDATIONS
  }
  else if (current_top_of_stack == "details") {   // logic specific to when navigating away from the Details screen
    // Clean up background image if navigating away from Details screen, the only place to go is back to "browse"
    var backgroundImage = document.getElementById("backgroundimage");
    // If the current screen has a background image, remove it
    if (backgroundImage != null || backgroundImage != undefined) {
      document.getElementsByTagName('body')[0].removeChild(backgroundImage);
    }
    clearScreenDivThroughRemoveChildren("detail-display");
    //addAnimeToWatchedList
    addAnimeToWatchedList();
  }
  else if (current_top_of_stack == "watchlist") {
    clearScreenDivThroughRemoveChildren("watch-list-display");
  }

  // we only want at most one screen of each kind in the stack at a time -- we don't want each consecutive search to add multiple "browses" to our stack,
  //  so we don't restore stack only in that case
  if (current_top_of_stack != "browse" || screenType != "browse") {
    //restore stack
    screen_stack.push(current_top_of_stack);
  }

  // modifies the screen_stack appropriately to account for the upcoming screen change
  if (screenType == "browse" || screenType == "details" || screenType == "watchlist" || screenType == "recommendations" || screenType == "help") {
    screen_stack.push(screenType);
  }
  else if (screenType == "back") {
    screen_stack.pop();   // pops off the 'current' screen
    current_top_of_stack = screen_stack.pop();
    screenType = current_top_of_stack;    // the 'next' screen to show will be the one that is now at the top of the stack
    screen_stack.push(current_top_of_stack);
  }

  // calls the getAnime method with the appropriate argument(s)
  if (screenType !== "watchlist" && screenType !== "help") {
    getAnime(screenType, query, exclusions);
  }
  else if (screenType == "watchlist") {
    displayWatchedList();
  }
  else {
    //displayHelpScreen();
  }

  if (screenType == "recommendations") {
    screenType = "browse";    // update so that the below logic can show the correct browse/search/recommendations screen  
  }

  $('.dynamic-app-screen').css("display", "none");
  var screenToShow = document.getElementById(screenType);
  screenToShow.setAttribute("style", "display: block;");
}

function searchForAnime() {
  var searchQuery = document.getElementById("search-input").value;
  switchScreens("browse", searchQuery);
}

function navigateBack() {
  switchScreens("back", "");
}

function openNavigationMenu() {
  document.getElementById("navigation-menu").style.height = "100%";
}

function closeNavigationMenu() {
  document.getElementById("navigation-menu").style.height = "0%";
}

function menuOptionPressed(menuOption) {  // Could be Browse, Watchlist, Recommendations, or Help
  if (menuOption == "recommendations") {
    getAnimeRecommendations();
  }
  else {
    switchScreens(menuOption, "");
  }
  closeNavigationMenu();    // close the menu now that an option has been selected
}

function startLoadingAnime() {
  // shows cool sonar loading screen and initializes procedure for getting the OAuth access_token 
  if(!sonarOn){
    $('#sonar-wave').css("display", "block");
    sonarOn = true;
    getOAuthAccessToken();
  }
  else {
    $('#sonar-wave').css("display", "none");
    sonarOn = false;
  }
}

function getOAuthAccessToken() {
  callDefaultGetAnime = true;
  var oauth2Endpoint = 'https://anilist.co/api/auth';
  var xhr = new XMLHttpRequest();
  xhr.open('POST', oauth2Endpoint + '/access_token?' + 'grant_type=client_credentials&client_id=' + YOUR_CLIENT_ID + '&client_secret=' + YOUR_CLIENT_SECRET);
  xhr.onreadystatechange = function (e) {
    var responseData = xhr.responseText;
    if ((responseData !== "") && (IsJsonString(responseData)) && callDefaultGetAnime) {
      var responseDataJSON = JSON.parse(responseData);
      access_token = responseDataJSON.access_token;
      //console.log("access_token is: " + access_token);
      callDefaultGetAnime = false;
      switchScreens("browse", "");
    }
  };
  xhr.send(null);
}

function getAnime(type, query, exclusions) {     //
  var displayAnimeCallCounter = 0;
  var oauth2Endpoint = 'https://anilist.co/api';
  var xhr = new XMLHttpRequest();
  // large conditional structure here to handle the different kinds of anilist api queries, using event objects as arguments?
  if (type == "browse") { //the default is to show the 'recent' anime
    if (query == "") {
      xhr.open('GET', oauth2Endpoint + '/browse/anime?' + 'access_token=' + access_token + '&full_page=true&year='+(new Date().getFullYear()));
    }
    else {  // something has been entered in the search bar
      xhr.open('GET', oauth2Endpoint + '/anime/search/'+ query +'?' + 'access_token=' + access_token);
    }
  }
  else if (type == "details") {   //gets details for a specific anime given its id number
    xhr.open('GET', oauth2Endpoint + '/anime/'+query+'/page?' + 'access_token=' + access_token);
  }
  else if (type == "recommendations") {
    xhr.open('GET', oauth2Endpoint + '/browse/anime?' + 'access_token=' + access_token + '&genres=' + query +'&genres_exclude=' + exclusions + '&sort=score-desc');
  }
  //xhr.open('GET', oauth2Endpoint + '/anime/search/hero?' + 'access_token=' + access_token + '&sort=score');
  xhr.onreadystatechange = function (e) {
    var animeData = xhr.response;
    //console.log(animeData);
    //before trying to display, check if the obtained JSON is valid
    if ((animeData !== "") && (IsJsonString(animeData))) {
      // means the API call was successful, now call the successcallback which will ensure that the display is only shown AFTER the images can be loaded
      if ((type == "browse" || type == "recommendations") && displayAnimeCallCounter < 1 ) {
        displayAnimeThumbnails(JSON.parse(animeData));
        displayAnimeCallCounter++;
      }
      else if (type == "details" && displayAnimeCallCounter < 1) {
        displayAnimeDetails(JSON.parse(animeData));
        displayAnimeCallCounter++;
      }
    }
  };
  xhr.send(null);
}

function displayAnimeThumbnails(animeData) {
  //some constants
  // Aim to show three thumbnails per line on mobile and four on desktop
  var isMobileScreen = false;
  var thumbnailWidth = 250;
  var thumbnailHeight = 350;
  var thumbnailAnimeScoreRadius = 50;
  // If the size of the screen is less than iPad portrait width, then treat as mobile

  // creates a 'box' div for each anime then puts the image in that 'box'
  for(var i=0; i<animeData.length; i++){     //animeData.length
    var showThisAnime =  checkIfAnimeShouldBeShown(animeData[i]);
    
    if (showThisAnime === true) {
      //put a thumbnail container into the thumbnail display
      var thumbnailContainer = document.createElement("div");
      thumbnailContainer.setAttribute("class", "thumbnail-container");
      thumbnailContainer.setAttribute("onclick", "switchScreens('details', "+animeData[i].id+");");
      thumbnailContainer.setAttribute("style", "position: relative; max-width:"+thumbnailWidth+"px; max-height: "+thumbnailHeight+"px; display: inline-block; margin: 0.3em;");
      document.getElementById("thumbnail-display").appendChild(thumbnailContainer);

      //put the image in the thumbnail container
      var animeIcon = document.createElement("img");
      animeIcon.setAttribute("src", animeData[i]["image_url_lge"]);
      animeIcon.setAttribute("style", "position: relative; width: 100%; margin: 0 auto;");
      animeIcon.setAttribute("class", "image-hover-opacity");
      thumbnailContainer.appendChild(animeIcon);

      //put the title of the Anime on the image TODO (visibility:hidden;)
      var animeTitleOnThumbnail = document.createElement("div");
      animeTitleOnThumbnail.setAttribute("class", "thumbnail-overlay");
      // animeTitleOnThumbnail.setAttribute("style", "");
      thumbnailContainer.appendChild(animeTitleOnThumbnail);

      var animeTitleToOverlay = document.createElement("p");
      animeTitleToOverlay.setAttribute("class", "highlighted-text");
      animeTitleToOverlay.setAttribute("style", "font-family: sansation; color: black;");
      var animeTitleTextNode = document.createTextNode(animeData[i].title_english);
      animeTitleToOverlay.appendChild(animeTitleTextNode);
      animeTitleOnThumbnail.appendChild(animeTitleToOverlay);
      
      //put container div for the rating on the image
      var animeRatingOnThumbnail = document.createElement("div");
      animeRatingOnThumbnail.setAttribute("style", "position: relative; transform: translateY(-280%); display: block; float: right; background-color: #C70025; width: "+thumbnailAnimeScoreRadius+"px; height: "+thumbnailAnimeScoreRadius+"px; -moz-border-radius: "+(thumbnailAnimeScoreRadius/2)+"px; -webkit-border-radius: "+(thumbnailAnimeScoreRadius/2)+"px; border-radius: "+(thumbnailAnimeScoreRadius/2)+"px; text-align: center;");
      thumbnailContainer.appendChild(animeRatingOnThumbnail);

      //put the text for the rating in the container div for the rating
      var animeScoreToDisplay = document.createElement("p");
      animeScoreToDisplay.setAttribute("style", "font-family: sansation; color: white;");
      var animeScoreTextNode = document.createTextNode(animeData[i].average_score);
      animeScoreToDisplay.appendChild(animeScoreTextNode);
      animeRatingOnThumbnail.appendChild(animeScoreToDisplay);
    }
    //otherwise the anime is not to be shown
  }
}

function generateBackButton(targetId) {
  //Place the back button first
  var backButton = document.createElement("input");
  backButton.setAttribute("id", "backbutton");
  backButton.setAttribute("onclick", "navigateBack();");
  backButton.setAttribute("type", "submit");
  var leftArrow = '\u2190';
  backButton.setAttribute("value", leftArrow);
  document.getElementById(targetId).appendChild(backButton);
}

function displayAnimeDetails(animeData) {
  // console.log(animeData);
  var bannerExists = false;

  //Place the back button first
  generateBackButton("detail-display");

  var bannerURL = animeData.image_url_banner;
  //show banner if one is available, if we have a banner we should probably transpose the anime title on top of it:
  if (bannerURL !== null && bannerURL !== undefined) {
    var animeBanner = document.createElement("img");
    animeBanner.setAttribute("src", bannerURL);
    animeBanner.setAttribute("style", "position: relative; width: 100%; margin: 0 auto;");
    document.getElementById("detail-display").appendChild(animeBanner);
    bannerExists = true;
  }
  //put the anime name as the title
  var animeNameAsTitle = document.createElement("h2");
  var animeNameTextNode = document.createTextNode(animeData.title_english);
  
  if (bannerExists) {
    animeNameAsTitle.setAttribute("style", "font-size: 4vw; transform: translateY(-250%); font-family: sansation; color: white; margin-bottom: -60px; overflow: hidden;");
    var titleHighlight = document.createElement("span");
    titleHighlight.setAttribute("class", "highlighted-text");
    titleHighlight.appendChild(animeNameTextNode);
    animeNameAsTitle.appendChild(titleHighlight);
  }
  else {
    animeNameAsTitle.setAttribute("style", "font-size: 4vw; font-family: sansation; overflow: hidden;");
    animeNameAsTitle.appendChild(animeNameTextNode);
  }
  document.getElementById("detail-display").appendChild(animeNameAsTitle);

  //put the image as the background image for the detail-display
  var animeImage = document.createElement("img");
  animeImage.setAttribute("src", animeData.image_url_lge);
  animeImage.setAttribute("id", "backgroundimage");
  document.getElementsByTagName('body')[0].appendChild(animeImage);

  //option to add to Watched as either "Liked" or "Disliked"
  var watchedContainerDiv = document.createElement("div");
  watchedContainerDiv.setAttribute("class", "option-bar");
  var watchedDiv = document.createElement("div");
  var likedDiv = document.createElement("div");
  var dislikedDiv = document.createElement("div");

  var watchedDivTitle = document.createElement("p");
  watchedDivTitle.setAttribute("class", "option-bar-question");
  var watchedDivTitleText = document.createTextNode("Watched?");
  watchedDivTitle.appendChild(watchedDivTitleText);
  watchedContainerDiv.appendChild(watchedDivTitle);

  var watchedDivLiked = document.createElement("p");
  watchedDivLiked.setAttribute("class", "option-bar-option option-bar-liked");
  watchedDivLiked.setAttribute("onclick", "this.style.backgroundColor = '#ff0000'; addAnimeToWatchedListTemporarily("+true+",'"+animeData.id+"','"+animeData.title_english+"','"+animeData.genres+"','"+animeData.image_url_lge+"');");   //genres is an array
  var watchedDivLikedText = document.createTextNode("Liked");
  watchedDivLiked.appendChild(watchedDivLikedText);
  watchedContainerDiv.appendChild(watchedDivLiked);

  var watchedDivDisliked = document.createElement("p");
  watchedDivDisliked.setAttribute("class", "option-bar-option option-bar-disliked");
  watchedDivDisliked.setAttribute("onclick", "this.style.backgroundColor = '#ff0000'; addAnimeToWatchedListTemporarily("+false+",'"+animeData.id+"','"+animeData.title_english+"','"+animeData.genres+"','"+animeData.image_url_lge+"');");
  var watchedDivDislikedText = document.createTextNode("Disliked");
  watchedDivDisliked.appendChild(watchedDivDislikedText);
  watchedContainerDiv.appendChild(watchedDivDisliked);

  document.getElementById("detail-display").appendChild(watchedContainerDiv);

  //put the details container into the detail-display
  var animeDetailsContainer = document.createElement("div");
  animeDetailsContainer.setAttribute("id", "animeDetails");
  animeDetailsContainer.setAttribute("style", "position: relative; display: inline-block; padding: 0 0.5em; width: 100%");
  document.getElementById("detail-display").appendChild(animeDetailsContainer);
  
  //put the synopsis/details into the details container
  var animeDescriptionHolder = document.createElement("p");
  animeDescriptionHolder.setAttribute("style", "font-family: sansation; font-size: 3.5vw; margin-top: -50px;");
  animeDescriptionHolder.innerHTML = animeData.description;
  animeDetailsContainer.appendChild(animeDescriptionHolder);

  // Add a DIV that hold two items side-by-side:
  // The NUMBER OF EPISODES and the AIRING_STATUS (including next ep release date if recent?)

  //put graph for breakdown of anime rating
  var ratingBarGraph = document.createElement("canvas");
  ratingBarGraph.setAttribute("id", "rating-bar-graph");
  ratingBarGraph.setAttribute("class", "bar-graph");
  animeDetailsContainer.appendChild(ratingBarGraph);

  // make bar graph using Chart.js
  new Chart(document.getElementById("rating-bar-graph"), {
    type: 'bar',
    data: {
      labels: ["10", "20", "30", "40", "50", "60", "70", "80", "90", "100"],
      datasets: [
        {
          label: "Ratings",
          backgroundColor: ["#3e95cd", "#8e5ea2","#3cba9f","#e8c3b9","#c45850","#3e95cd", "#8e5ea2","#3cba9f","#e8c3b9","#c45850"],
          data: [animeData.score_distribution[10], animeData.score_distribution[20], animeData.score_distribution[30], animeData.score_distribution[40],
                animeData.score_distribution[50], animeData.score_distribution[60], animeData.score_distribution[70], animeData.score_distribution[80],
                animeData.score_distribution[90], animeData.score_distribution[100]]
        }
      ]
    },
    options: {
      legend: { display: false },
      title: {
        display: true,
        text: 'Rating Distribution'
      }
    }
  });

  //put a pull down for reviews and "related" anime

  // put the video in a div
  var videoContainer = document.createElement("div");
  videoContainer.setAttribute("class", "intrinsic-container");

  // If animeData.youtube_id exists, then make a video on screen that has link to "www.youtube.com/watch?v="+animeData.youtube_id
  //<iframe id="video" width="420" height="315" src="//www.youtube.com/embed/9B7te184ZpQ?rel=0" frameborder="0" allowfullscreen></iframe>
  if (animeData.youtube_id != null && animeData.youtube_id != undefined) {
    var youtubeVideoFrame = document.createElement("iframe");
    // youtubeVideoFrame.setAttribute("class", "intrinsic-container");
    // youtubeVideoFrame.setAttribute("width", "100%");
    // youtubeVideoFrame.setAttribute("height", "60%");
    youtubeVideoFrame.setAttribute("frameborder", "0");
    youtubeVideoFrame.setAttribute("allowfullscreen", "");
    youtubeVideoFrame.setAttribute("src", "https://www.youtube.com/embed/"+animeData.youtube_id);
    videoContainer.appendChild(youtubeVideoFrame);

    animeDetailsContainer.appendChild(videoContainer);
  }

  //perhaps include links to the anime (to watch?) and open those in the inAppBrowser :3 window.open or if mobile: cordova.InAppBrowser.open with target _self?
  if (animeData.external_links.length > 0) {
    var logoSource;
    for(var i=0; i<animeData.external_links.length; i++){
      if (animeData.external_links[i].site == "Hulu") {
        logoSource = "https://everydayelectronics365.files.wordpress.com/2016/12/wp-1480810101789.png";
      }
      else if (animeData.external_links[i].site == "Funimation") {
        logoSource = "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Funimation_Logo.svg/1280px-Funimation_Logo.svg.png"; //"http://photos.prnewswire.com/prnvar/20160107/319992LOGO";
      }
      else if (animeData.external_links[i].site == "Crunchyroll") {
        logoSource = "http://radio-tako.fr/wp-content/uploads/2016/04/Crunchyroll_Logo_horz.jpg";
      }
      else if (animeData.external_links[i].site == "Official Site") {
        logoSource = "http://official-design.com/lib/images/official_logo_white_frame.png";
      }
      else if (animeData.external_links[i].site == "Twitter") {
        logoSource = "http://www.statisticbrain.com/wp-content/uploads/2015/10/twitter-company-statistics.jpg";
      }
      else if (animeData.external_links[i].site == "Netflix") {
        logoSource = "https://68.media.tumblr.com/15bafa3cc16f60d30f24ae2317113a55/tumblr_n1e17l0Qej1spsp70o1_500.png";
      }
      else if (animeData.external_links[i].site == "Animelab") {
        logoSource = "https://snapthirty.files.wordpress.com/2014/06/animelab-logo.png?w=600";
      }
      else if (animeData.external_links[i].site == "Amazon") {
        logoSource = "http://logonoid.com/images/amazon-logo.png";
      }
      else if (animeData.external_links[i].site == "Viz") {
        logoSource = "http://cdn.animeherald.com/aniheraldcdn/wp-content/uploads/2014/09/VIZ-Media-Horizontal-Logo-Color.jpg";
      }
      else if (animeData.external_links[i].site == "Daisuki") {
        logoSource = "http://news.xlcgamingnetwork.com/wp-content/uploads/2015/04/daisuki-logo-1.png";
      }

      //put each image/link in a div that has width: 100%
      var linkRow = document.createElement("div");
      linkRow.setAttribute("style", "width: 100%; text-align: center;");

      var linkToClick = document.createElement("a");
      linkToClick.setAttribute("href", animeData.external_links[i].url);
      linkToClick.setAttribute("target", "_blank");   // to open link in new tab
      var watchAnimeButton = document.createElement("img");
      watchAnimeButton.setAttribute("width", "25%");
      watchAnimeButton.setAttribute("height", "auto");
      watchAnimeButton.setAttribute("id", "watchAnimeButton"+i);
      watchAnimeButton.setAttribute("style", "position: relative; margin: auto; display: block; margin-top: 10px;");
      watchAnimeButton.setAttribute("src", logoSource);
      linkToClick.appendChild(watchAnimeButton);
      linkRow.appendChild(linkToClick);
      animeDetailsContainer.appendChild(linkRow);
    }
  }
}

function fillWatchlist(watchlist) {
  var listOfAnime = document.getElementById("anime-list");
  if (watchlist != null) {
    for (var i=0; i<watchlist.length; i++) {
      var animeListItem = document.createElement("li");
      animeListItem.setAttribute("class", "ui-li-has-alt ui-li-has-thumb ui-first-child");
      // animeListItem.setAttribute("data-split-icon", "delete");      // try putting this onto the ul?
      // animeListItem.setAttribute("data-split-theme", "a");

      var clickability = document.createElement("a");
      clickability.setAttribute("href", "#");
      clickability.setAttribute("class", "ui-btn");
      // clickability.innerHTML = watchlist[i].title;
      animeListItem.appendChild(clickability);

      var animeImage = document.createElement("img");
      animeImage.setAttribute("src", watchlist[i].icon_url);
      clickability.appendChild(animeImage);

      var animeListItemTitle = document.createElement("h2");
      animeListItemTitle.innerHTML = watchlist[i].title;
      clickability.appendChild(animeListItemTitle);

      var animeListItemSubtitle = document.createElement("p");
      animeListItemSubtitle.innerHTML = watchlist[i].title;
      clickability.appendChild(animeListItemSubtitle);

      var removeFromListButton = document.createElement("a");
      removeFromListButton.setAttribute("href", "#remove-from-watchlist-popup");
      removeFromListButton.setAttribute("class", "ui-btn ui-btn-icon-notext ui-icon-delete ui-btn-a");
      removeFromListButton.setAttribute("data-rel", "popup");
      removeFromListButton.setAttribute("data-position-to", "window");
      removeFromListButton.setAttribute("data-transition", "pop");
      removeFromListButton.innerHTML = "Remove";
      animeListItem.appendChild(removeFromListButton);

      listOfAnime.appendChild(animeListItem);
    }
  }
}

function displayWatchedList() {
  var watchlistLiked = getDataFromStore('watchlistLiked');      // array of IDs and titles
  var watchlistDisliked = getDataFromStore('watchlistDisliked');

  //Place the back button first
  generateBackButton("watch-list-display");

  var watchlistDisplay = document.getElementById("watch-list-display");

  //Display the title "Watchlist"
  var watchlistTitle = document.createElement("h2");
  watchlistTitle.setAttribute("class", "centered-title");
  watchlistTitle.innerHTML = "Watchlist";
  watchlistDisplay.appendChild(watchlistTitle);

  var watchlistContainer = document.createElement("ul");
  watchlistContainer.setAttribute("id", "anime-list");
  watchlistContainer.setAttribute("data-role", "listview");
  watchlistContainer.setAttribute("data-split-icon", "delete");
  watchlistContainer.setAttribute("data-split-theme", "a");
  watchlistContainer.setAttribute("data-inset", "true");
  watchlistContainer.setAttribute("class", "ui-listview ui-listview-inset ui-corner-all ui-shadow");
  watchlistDisplay.appendChild(watchlistContainer);

  // var watchlistContainer = document.getElementById("anime-list");
  // var listOfAnime = document.createElement("ul");
  // listOfAnime.setAttribute("data-role", "listview");
  // listOfAnime.setAttribute("data-inset", "true");
  // listOfAnime.setAttribute("data-split-icon", "delete");      // try putting this onto the ul?
  // listOfAnime.setAttribute("data-split-theme", "a");

  // make a list-divider as the first item with value "Liked"
  var likedHeader = document.createElement("li");
  likedHeader.setAttribute("data-role", "list-divider");
  likedHeader.innerHTML = "Liked";
  watchlistContainer.appendChild(likedHeader);

  // first make the liked watchlist
  fillWatchlist(watchlistLiked);

  // make a list-divider as the second item with value "Disliked"
  var disLikedHeader = document.createElement("li");
  disLikedHeader.setAttribute("data-role", "list-divider");
  disLikedHeader.innerHTML = "Disliked";
  watchlistContainer.appendChild(disLikedHeader);

  // make the disliked watchlist
  fillWatchlist(watchlistDisliked);
}

function getAnimeRecommendations() {   // this will actually just be like browse/search, just with a custom-made query to show recommended anime
  likedAnalytics = JSON.parse(localStorage.getItem('likedAnalytics'));
  dislikedAnalytics = JSON.parse(localStorage.getItem('dislikedAnalytics'));

  // get the three (3) most highly liked genres from likedAnalytics for the searchQuery
  var searchQuery = getHighestValuedGenresFromJSON(likedAnalytics, 3);

  // get the one (1) most highly disliked genre from the dislikedAnalytics for the exclusions
  var exclusions = getHighestValuedGenresFromJSON(dislikedAnalytics, 1);

  //format for query and exclusions should be the array elements separated by commas as one string
  switchScreens("recommendations", searchQuery.toString(), "");   //exclusions.toString()
}