/*global window, document, console, window, Show, Episode*/
var DATABASE_URL = "showtracker",
	MIRROR_MAIN = "http://thetvdb.com/",
	MIRROR_BANNERS = MIRROR_MAIN + "banners/",
	API_KEY = "01C061EC44C068BD",
	$ = window.$,
	dbConnector = null,
	currentSection = "calendar", // Active section of the page
	currentShow = null, // Show displaying information, easier for adding to collection
	showsArray = [], // All user shows with some info like watched episodes
	currentDate = new Date(Date.now()), // Current date to reset calendar
	calendarDate = new Date(currentDate.getTime()), // Date to show in calendar (prev or next months)
	serverTime;
/**
 * Gets server time
 */
function retrieveServerTime() {
	"use strict";
	$.ajax({
		type: "POST",
		url: MIRROR_MAIN + "api/Updates.php?type=none",
		async: true,
		dataType: "xml",
		// Success
		success: function(data) {
			// Parse XML just in case there is any error
			serverTime = new Date($(data).find("Time").text());
		},
		// Error
		error: function(xhr, status, error) {
			console.error("There was a problem retrieving server time:\n" + xhr.responseText);
		}
	});
}
/**
 * Finds and returns a show by Id
 */
function getShowById(showId) {
	for (var i = 0; i < showsArray.length; i++) {
		if (showsArray[i].data._id === showId) {
			return showsArray[i];
		}
	}
	return null;
}
/**
 * Return date in format YYYY-MM-DD
 */
Date.prototype.getDateFormated = function() {
	return this.getFullYear() + "-" + this.getMonth() + "-" + this.getDate();
};
/**
 * Click on a show name, open show page
 * @param {Object} event [[Description]]
 */
function onShowClick(event) {
	"use strict";
	event.preventDefault();
	// Name attribute keep the show id
	displayShowInfo(event.target.getAttribute("name"));
}
/**
 * Click on an episode checkbox, toggle watched value
 * @param {Object} event [[Description]]
 */
function onEpisodeWatchedClick(event) {
	"use strict";
	// This episode should be in currentShow
	for (var i = 0; i < currentShow.data.episodes.length; i++) {
		if (currentShow.data.episodes[i]._id === event.target.name) {
			currentShow.data.episodes[i].watched = !currentShow.data.episodes[i].watched;
			currentShow.data.watchedEpisodes = countWatchedEpisodes(currentShow);
			saveData();
			fillAllShows();
			return;
		}
	}
}
/**
 * [[Checks if episode is marked as watched by the user]]
 * Returns Episode object or null
 */
function getEpisodeInfo(show, seasonNumber, episodeNumber) {
	for (var i = 0; i < show.data.episodes.length; i++) {
		if (show.data.episodes[i].data.season === seasonNumber && show.data.episodes[i].data.number === episodeNumber) {
			return show.data.episodes[i];
		}
	}
	return null;
}
/**
 * Retrieve show info and show it
 * @param  {[int]} showId [Id of the show to search for]
 * @param  {[boolean]} onlyPending [Show only pending episodes]
 */
function displayShowInfo(showId, onlyPending) {
	"use strict";
	$.ajax({
		type: "POST",
		/*http://thetvdb.com/api/01C061EC44C068BD/series/81797/all/*/
		/*url: MIRROR_MAIN + "api/" + API_KEY + "/series/" + showId + + "/all/" */
		url: MIRROR_MAIN + "api/" + API_KEY + "/series/" + showId + "/all/",
		async: true,
		dataType: "xml",
		// Success
		success: function(data) {
			if ($(data).text().trim() === "") {
				$("#modalSeriesNotFound").foundation("reveal", "open");
				return;
			}
			currentShow = getShowInCollection(showId);
			var seriesInfo = $(data).find("Series")[0],
				inCollection = (currentShow !== null);
			// GENERAL INFO
			if (!inCollection) {
				// Not in collection
				// Get show info
				currentShow = new Show();
				currentShow.data._id = showId;
				currentShow.data.name = $(seriesInfo).find("SeriesName").text();
				currentShow.data.overview = $(seriesInfo).find("Overview").text();
				currentShow.data.firstAired = $(seriesInfo).find("FirstAired").text();
				currentShow.data.network = $(seriesInfo).find("Network").text();
				currentShow.data.banner = MIRROR_BANNERS + $(seriesInfo).find("banner").text();
			}
			// Set page info
			$("#showInfoName")[0].textContent = currentShow.data.name;
			$("#showInfoOverview")[0].textContent = currentShow.data.overview;
			$("#showInfoFirstAired")[0].textContent = currentShow.data.firstAired;
			$("#showInfoNetWork")[0].textContent = currentShow.data.network;
			$("#showInfoBanner")[0].src = currentShow.data.banner;
			// Other info we don't need to save
			$("#showInfoRuntime")[0].textContent = $(seriesInfo).find("Runtime").text();
			$("#showInfoStatus")[0].textContent = $(seriesInfo).find("Status").text();
			$("#showInfoAirDayTime")[0].textContent = $(seriesInfo).find("Airs_DayOfWeek").text() + " at " + $(seriesInfo).find("Airs_Time").text();
			$("#showInfoIMDB").html("<a href='http://www.imdb.com/title/" + $(seriesInfo).find("IMDB_ID").text() + "'>" + currentShow.data.name + " on IMDB</a>");
			$("#showInfoTVDB").html("<a href=\"" + MIRROR_MAIN + "?tab=series&id=" + showId + "\">" + currentShow.data.name + " on TVDB</a>");
			// SEASONS AND EPISODES
			// Cleanup
			$("#showInfo_seasons_tabs").html("");
			$("#showInfo_seasons_eps").html("");
			// Retrieve episodes info and print it
			var currentSeason = -1,
				seasonsCount = 0,
				episodeCount = 0;
			$(data).find("Episode").each(function() {
				var seasonNumber = parseInt($(this).find("SeasonNumber").text()),
					htmlContent = "";
				// SEASON
				if (currentSeason < seasonNumber) {
					seasonsCount++;
					currentSeason = seasonNumber;
					// Create new season tab and table
					var seasonName = currentSeason;
					if (currentSeason === 0) {
						seasonName = "Extras";
					}
					// TAB
					htmlContent = "<dd><a id=\"showInfo_seasons_tabs-" + currentSeason + "\" class=\"showInfo__season--tab\" href='#showInfo_seasons_eps-" + currentSeason + "' data-season=" + currentSeason + ">" + seasonName + "</a></dd>";
					$("#showInfo_seasons_tabs").append(htmlContent);
					// TABLE
					htmlContent = "<div class=\"content\" id=\"showInfo_seasons_eps-" + currentSeason + "\"><table id=\"showInfo_seasons_eps-table-" + currentSeason + "\" class=\"small-12 column\">" + "<thead><tr><th>Episode</th><th>Name</th><th>Air Date</th><th>Description</th><th>Watched</th></tr></thead>" + "<tbody></tbody></table>" + "</div>";
					$("#showInfo_seasons_eps").append(htmlContent);
				}
				// EPISODE
				episodeCount++;
				var episode = null;
				// Show already in collection
				if (inCollection) {
					episode = getEpisodeInfo(currentShow, seasonNumber, parseInt($(this).find("EpisodeNumber").text()));
				}
				// New episode
				if (episode == null) {
					// Show is not in collection, create it
					episode = new Episode();
					episode.data._id = $(this).find("id").text();
					episode.data.name = $(this).find("EpisodeName").text();
					episode.data.overview = $(this).find("Overview").text();
					episode.data.season = seasonNumber;
					episode.data.number = parseInt($(this).find("EpisodeNumber").text());
					episode.data.airDate = $(this).find("FirstAired").text();
					currentShow.data.episodes.push(episode);
				}
				// Get the tbody of the table in the current season tab
				htmlContent = "<tr><td>" + episode.data.number + "</td>" + "<td>" + episode.data.name + "</td>" + "<td>" + episode.data.airDate + "</td>" + "<td>" + episode.data.overview + "</td>";
				// Check if episode is watched
				var epWatched = '';
				if (inCollection) {
					if (episode.data.watched === true) {
						epWatched = 'checked';
					}
					htmlContent += "<td><label for='cb-" + episode.data._id + "'>Mark as watched</label>" + "<input type='checkbox' id='cb-" + episode.data._id + "' name='" + episode.data._id + "' " + epWatched + "></td>";
				}
				htmlContent += "</tr>";
				$("#showInfo_seasons_eps-table-" + currentSeason + " tbody").append(htmlContent);
				// Get the new checkbox and set the event
				if (inCollection) {
					$("[name='" + episode.data._id + "']").click(onEpisodeWatchedClick);
				}
			});
			// Set seasons and episodes info
			$("#showInfoSeasons")[0].textContent = seasonsCount; // Last seasons found
			$("#showInfoEpisodes")[0].textContent = episodeCount;
			// Set user controls
			if (inCollection) {
				$("#showInfo__button--add").hide();
				$("#showInfo__button--remove").show();
				$(".showInfo__userControls").show();
			} else {
				$("#showInfo__button--add").show();
				$("#showInfo__button--remove").hide();
				$(".showInfo__userControls").hide();
			}
			goToSection("showInfo");
		},
		// Error
		error: function(xhr, status, error) {
			$("#modalServerError").foundation("reveal", "open");
			console.error("There was a problem retrieving series info:\n" + xhr.responseText);
		}
	});
}
/**
 * Checks if a show is in user collection
 */
function getShowInCollection(showId) {
	"use strict";
	for (var i = 0; i < showsArray.length; i++) {
		if (showsArray[i].data._id === showId) {
			return showsArray[i];
		}
	}
	return null;
}
/**
 * Prints a list of all series in user collection
 * @param  {[boolean]} onlyPending [Show only shows with pending episodes (not watched)]
 */
var fillAllShows = function fillAllShowsF(onlyPending) {
	"use strict";
	var showsCount = showsArray.length,
		showListRows = $("#showListRows");
	// Clear list
	$(showListRows).html("");
	$("#myshows h2")[0].textContent = "You are following " + showsCount + " shows";
	// List shows
	if (showsCount > 0) {
		for (var i = 0; i < showsCount; i++) {
			var pending = showsArray[i].data.episodes.length - showsArray[i].data.watchedEpisodes;
			// No pending episodes on this show
			if (onlyPending && pending === 0) {
				continue;
			}
			var row = document.createElement("tr"),
				cell = document.createElement("td"),
				link = document.createElement("a");
			// First col
			link.textContent = showsArray[i].data.name;
			$(link).click(onShowClick);
			// Save the TVDB Id of the show to get the complete info later
			link.setAttribute("name", showsArray[i].data._id);
			cell.appendChild(link);
			row.appendChild(cell);
			// Second col
			cell = document.createElement("td");
			cell.textContent = "Watched " + showsArray[i].data.watchedEpisodes + " out of " + showsArray[i].data.episodes.length + " episodes.";
			row.appendChild(cell);
			showListRows.append(row);
		}
	}
};
/**
 * Load local data from user file
 */
function loadLocalData(callback) {
	"use strict";
	$.ajax({
		type: "POST",
		url: "user-data.json",
		async: true,
		dataType: "json",
		// Success
		success: function(data) {
			if (data.length <= 0) {
				return;
			}
			var show = null; // To save every show info before pushing to array
			var episode = null;
			// For every show, save name and watched episodes
			for (var i = 0; i < data.length; i++) {
				// Create new show with basic info (just name)
				show = new Show();
				show.data._id = data[i]._id;
				show.data.name = data[i].name;
				show.data.seasons = data[i].seasons;
				show.data.overview = data[i].overview;
				show.data.banner = data[i].banner;
				show.data.watchedEpisodes = data[i].watchedEpisodes;
				show.data.firstAired = data[i].firstAired;
				show.data.network = data[i].network;
				// Get all episodes from this show
				var currentEps = data[i].episodes;
				for (var j = 0; j < currentEps.length; j++) {
					episode = new Episode();
					episode.data._id = currentEps[j]._id;
					episode.data.name = currentEps[j].name;
					episode.data.overview = currentEps[j].overview;
					episode.data.season = currentEps[j].season;
					episode.data.number = currentEps[j].number;
					episode.data.airDate = currentEps[j].airDate;
					episode.data.watched = currentEps[j].watched;
					// Save episode to show
					show.data.episodes.push(episode);
					/*if (episode.data.watched === true) {
						show.data.watchedEpisodes++;
					}*/
				}
				showsArray.push(show);
			}
			fillAllShows(false);
			populateCalendar();
			if (callback !== undefined) {
				callback();
			}
		},
		// Error
		error: function(xhr, status, error) {
			console.error(error);
			$("#modalLocalDataError").foundation("reveal", "open");
		}
	});
}
/**
 * Get data from database
 */
function retrieveUserShows() {
	"use strict";
	dbConnector.getAllDocs(function(docs) {
		for (var i = 0; i < docs.length; i++) {
			// Create Show and append data
			var show = new Show();
			show.data = docs[i].doc;
			showsArray.push(show);
		}
		fillAllShows(false);
		populateCalendar();
	});
}
/**
 * Import from EpisodeCalendar data file
 */
function importEpisodeCalendar() {
	"use strict";
	$.ajax({
		type: "POST",
		url: "user-data.json",
		async: true,
		dataType: "json",
		// Success
		success: function(data) {
			var show = null; // To save every show info before pushing to array
			var episode = null;
			// For every show, save name and watched episodes
			for (var i = 0; i < data.length; i++) {
				// Create new show with basic info (just name)
				show = new Show();
				show.data.name = data[i].show;
				// Get all episodes from this show
				while (i < data.length && data[i].show === show.data.name) {
					episode = new Episode();
					episode.data.name = data[i].name;
					episode.data.season = data[i].season;
					episode.data.number = data[i].number;
					episode.data.airDate = data[i].air_date;
					episode.data.watched = (data[i].watched === "true");
					// Save episode to show
					show.data.episodes.push(episode);
					if (episode.data.watched === true) {
						show.data.watchedEpisodes++;
					}
					i++;
				}
				showsArray.push(show);
			}
			if (callback !== undefined) {
				callback();
			}
		},
		// Error
		error: function(xhr, status, error) {
			console.error("There was a problem retrieving user data:\n" + xhr.responseText);
		}
	});
}
/**
 * Hides current section and shows called section
 * @param {[string]} section [Name of the section]
 */
function goToSection(section) {
	"use strict";
	// Update main menu state
	$("#menu--main__" + currentSection).removeClass("active");
	$("#menu--main__" + section).addClass("active");
	// Hide current section and show new section
	$("#" + currentSection).fadeOut("fast", function() {
		$("#" + section).fadeIn("fast");
		// Make new section the current one
		currentSection = section;
	});
}
/**
 * Search for shows matching some string
 */
function searchShows(name) {
	"use strict";
	$.ajax({
		type: "POST",
		url: MIRROR_MAIN + "api/GetSeries.php?seriesname=" + name,
		async: true,
		dataType: "xml",
		// Success
		success: function(data) {
			if ($(data).text().trim() === "") {
				$("#modalSearchNotFound").foundation("reveal", "open");
				return;
			}
			// Get and clear rows
			var searchListRows = $("#searchListRows");
			searchListRows.html("");
			// For each show found, print info
			$(data).find("Series").each(function(index) {
				var row = document.createElement("tr"),
					cell = document.createElement("td"),
					link = document.createElement("a");
				// First col
				link.textContent = $(this).find('SeriesName').text();
				$(link).click(onShowClick);
				// Save the TVDB Id of the show to get the complete info later
				link.setAttribute("name", $(this).find('seriesid').text());
				cell.appendChild(link);
				row.appendChild(cell);
				// Second col
				cell = document.createElement("td");
				cell.textContent = $(this).find('Overview').text();
				row.appendChild(cell);
				searchListRows.append(row);
			});
			goToSection("searchResults");
		},
		// Error
		error: function(xhr, status, error) {
			$("#modalServerError").foundation("reveal", "open");
			console.error("There was a problem retrieving series info:\n" + xhr.responseText);
		}
	});
}
/**
 * Saves shows to local file
 */
function saveData() {
	
}
/**
 * Adds a show to the user collection
 */
function addToCollection(show) {
	if (show !== null) {
		// Try insert into db
		dbConnector.insertShow(show, function(response) {
			if (response) {
				showsArray.push(show);
				// Refill shows table
				fillAllShows(false);
				// Redisplay show info
				displayShowInfo(show.data._id);
			}
		});
	}
}
/**
 * Remove a show from the user collection
 */
function removeFromCollection(show) {
	if (show !== null) {
		var id = show.data._id;
		// Try removing from db
		dbConnector.removeShow(show, function(response) {
			if (response) {
				for (var i = 0; i < showsArray.length; i++) {
					if (showsArray[i].data._id === id) {
						showsArray.splice(i, 1);
						break;
					}
				}
				// Refill shows table
				fillAllShows(false);
				// Redisplay show info
				displayShowInfo(id);
			}
		});
	}
}
/**
 * Gets a count of watched episodes in a show
 * @param  {[Object]} show
 * @return {[int]} [Watched count]
 */
function countWatchedEpisodes(show) {
	var count = 0;
	for (var i = 0; i < show.data.episodes.length; i++) {
		if (show.data.episodes[i].watched) {
			count++;
		}
	}
	return count;
}
/**
 * Marks all episodes in a show as value
 * @param  {[Object]} show
 * @param  {[boolean]} value
 */
function markAllEpisodesInShow(show, value) {
	for (var i = 0; i < show.data.episodes.length; i++) {
		show.data.episodes[i].watched = value;
	}
	show.data.watchedEpisodes = countWatchedEpisodes(show);
	saveData();
	displayShowInfo(show.data._id);
	fillAllShows(false);
}
/**
 * Marks all episodes in a show season as value
 * @param  {[Object]} show
 * @param  {[boolean]} value
 */
function markAllEpisodesInSeason(show, value) {
	// Get season active in info page
	var tabElement = $("#showInfo_seasons_tabs").find("dd [aria-selected='true']")[0];
	if (tabElement !== undefined) {
		var season = parseInt(tabElement.getAttribute("data-season"));
		for (var i = 0; i < show.data.episodes.length; i++) {
			if (show.data.episodes[i].season == season) {
				show.data.episodes[i].watched = value;
			}
		}
		show.data.watchedEpisodes = countWatchedEpisodes(show);
		saveData();
		displayShowInfo(show.data._id);
		fillAllShows(false);
	}
}
/**
 * Attach all event listeners
 */
function setEventListeners() {
	// Event listeners, use wrapper functions to pass argument
	$("#menu--main__search--button").click(function(e) {
		e.preventDefault();
		searchShows($("#menu--main__search--input").val());
	});
	$("#menu--main__calendar").click(function(e) {
		e.preventDefault();
		calendarDate = new Date(currentDate.getTime());
		createCalendarDays();
		populateCalendar();
		goToSection("calendar");
	});
	$("#calendarPrev").click(function(e) {
		e.preventDefault();
		// Go back 1 day from first day of month
		calendarDate.setDate(-1); // Sets the day of month (yeah ¬¬)
		createCalendarDays();
		populateCalendar();
	});
	$("#calendarNext").click(function(e) {
		e.preventDefault();
		calendarDate.setMonth(calendarDate.getMonth() + 1)
		createCalendarDays();
		populateCalendar();
	});
	$("#menu--main__myshows").click(function(e) {
		e.preventDefault();
		goToSection("myshows");
	});
	$("#showInfo__button--add").click(function(e) {
		e.preventDefault();
		addToCollection(currentShow);
	});
	$("#showInfo__button--remove").click(function(e) {
		e.preventDefault();
		removeFromCollection(currentShow);
	});
	$("#showInfo__button--markAll").click(function(e) {
		e.preventDefault();
		markAllEpisodesInShow(currentShow, true);
	});
	$("#showInfo__button--unmarkAll").click(function(e) {
		e.preventDefault();
		markAllEpisodesInShow(currentShow, false);
	});
	$("#showInfo__button--markSeason").click(function(e) {
		e.preventDefault();
		markAllEpisodesInSeason(currentShow, true);
	});
	$("#showInfo__button--unmarkSeason").click(function(e) {
		e.preventDefault();
		markAllEpisodesInSeason(currentShow, false);
	});
	$("#myshows__checkboxWatched").change(function(e) {
		e.preventDefault();
		// prop gets direct value
		fillAllShows($(this).prop("checked"));
	});
	$("#showInfo__checkboxWatched").change(function(e) {
		e.preventDefault();
		// prop gets direct value
		displayShowInfo(currentShow.data._id, $(this).prop("checked"));
	});
}
/**
 * Creates days for month calendar
 */
function createCalendarDays() {
	"use strict";
	var month = calendarDate.getMonth(),
		year = calendarDate.getFullYear(),
		tableBody = $("#calendar__table--tbody"),
		weekRow = "",
		firstDate = new Date(year, month, 1), // First date of month
		lastDate = new Date(year, month + 1, 0), // Last date of month
		daysInMonth = lastDate.getDate(), // Total days in month
		weekDayCount = 0;
	// First clear calendar
	$(tableBody).html("");

	// Month name
	var monthNames = [ "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December" ];
	$("#calendarDate").text(monthNames[month] + " " + calendarDate.getFullYear());
	// Create days
	weekRow = "<tr>";
	// Create previous month days, empty
	var firstDay = firstDate.getDay();
	if (firstDay != 1) {
		// getDay start on sunday as 0, we want Monday
		var i = 1;
		while (i != firstDay) {
			weekRow += "<td data-date=\"\"><span class=\"calendar__cell__header\"> </span></td>";
			i++;
			weekDayCount++;
			if (i > 6) {
				i = 0;
			}
		}
	}
	// Create rest of the month
	for (var j = 1; j <= daysInMonth; j++) {
		weekRow += "<td data-date=\"" + year + "-" + month + "-" + j + "\"><span class=\"calendar__cell__header";
		// Today highlight
		var dayDate = new Date(year, month, j);
		if (year === currentDate.getFullYear() &&
			month === currentDate.getMonth() &&
			j === currentDate.getDate()) { 
			weekRow += " calendar__cell--active";
		}
		weekRow += "\">" + j + "</span></td>";
		weekDayCount++;
		if (weekDayCount > 6) { // New week
			weekDayCount = 0;
			weekRow += "</tr>";
			tableBody.append(weekRow);
			if (j + 1 <= daysInMonth) {
				weekRow = "<tr>"; // Start new row
			}
		}
	}
	// Next month days
	while (weekDayCount != 0) {
		weekRow += "<td data-date=\"\"><span class=\"calendar__cell__header\"> </span></td>";
		weekDayCount++;
		// Close week and month
		if (weekDayCount > 6) {
			weekDayCount = 0;
			weekRow += "</tr>";
			tableBody.append(weekRow);
		}
	}
}
/**
 * Fills calendar days with episode events
 */
function populateCalendar() {
	// Get every show and look into episode date
	for (var i = 0; i < showsArray.length; i++) {
		var show = showsArray[i];
		for (var j = 0; j < show.data.episodes.length; j++) {
			var episode = show.data.episodes[j],
				episodeDate = new Date(episode.data.airDate);
			if (calendarDate.getFullYear() == episodeDate.getFullYear() && calendarDate.getMonth() == episodeDate.getMonth()) {
				// Get day cell and print episode info
				var tdDay = $("td[data-date=\"" + episodeDate.getDateFormated() + "\"]"),
					cbId = "cal-episode-" + episode.data._id;
				$(tdDay).append("<div class=\"calendar__episode\">" + "<input id=" + cbId + " name=\"" + episode.data._id + "\" data-show=" + show.data._id + " type=\"checkbox\" />" + "<label for=" + cbId + ">" + show.data.name + "</label><br>" + "<label for=" + cbId + ">(s" + episode.data.season + "e" + episode.data.number + ") " + episode.data.name + "</label>" + "</div>");
				// Set event and state for the checkbox
				var cb = $("input[id='" + cbId + "']");
				$(cb).click(function(event) {
					currentShow = getShowById(this.getAttribute("data-show"));
					onEpisodeWatchedClick(event);
				});
				$(cb).prop("checked", episode.data.watched);
			}
		}
	}
}
/**
 * Wait for DOM elements to be loaded and ready
 */
$(document).ready(function(argument) {
	"use strict";
	// Set up database
	dbConnector = new DBConnector();
	//dbConnector.connect("https://showtracker.couchappy.com/showtracker/");
	dbConnector.connect(DATABASE_URL);
	dbConnector.getInfo();
	// Initialize API
	currentSection = "calendar";
	// Hide all sections
	$(".article--main").hide();
	// Set listeners for most buttons
	setEventListeners();
	// Import data from Episode Calendar using json file
	//importEpisodeCalendar();
	// Loads data from file an+d checks for updates
	retrieveUserShows();
	// Create calendar
	createCalendarDays(currentDate.getMonth(), currentDate.getFullYear());
	// Show main section, calendar
	goToSection("calendar");
});