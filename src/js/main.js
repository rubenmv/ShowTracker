/*global window, document, console, window, Show, Episode*/
var $ = window.$,
	dbConnector = null,
	currentSection = "calendar", // Active section of the page
	currentShow = null, // Show displaying information, easier for adding to collection
	showsArray = [], // All user shows with some info like watched episodes
	currentDate = new Date(Date.now()),
	calendarDate = currentDate, // we only care about month and year
	serverTime,
	MIRROR_MAIN = "http://thetvdb.com/",
	MIRROR_BANNERS = MIRROR_MAIN + "banners/",
	API_KEY = "01C061EC44C068BD";

/**
 * DBConnector class
 * Manages the connection and operations to the local/external database
 */
(function(window) {
	// Constructor
	function DBConnector() {
		this.databaseUrl = null; // Url or name (local) to the database
		this.connection = null;
	}

	/**
	 * Checks if database exists and connects to it or creates a new one
	 * @param  {[string]} connString [URL to the database]
	 */
	DBConnector.prototype.connect = function(connString) {
		this.databaseUrl = connString;
		this.connection = new PouchDB(connString);
	};

	/**
	 * [Returns Database info]
	 * @param  {Function} callback [callback function]
	 * @return {[object]}            [info object]
	 */
	DBConnector.prototype.getInfo = function(callback) {
		this.connection.info().then(function(info) {
			callback.call(this, info);
		});
	};
	DBConnector.prototype.getAllDocs = function(callback) {
		this.connection.allDocs({include_docs: true}, function (err, docs) {
			if (err) {
				console.log("ERROR RETRIEVING ALL DOCS: " + err);
			}
			else {
				callback.call(this, docs.rows);
			}
		});
	};
	/**
	 * [Returns a Show object]
	 * @param  {[type]}   showId   [unique id for the show]
	 * @param  {Function} callback [return function]
	 * @return {[Show]}            [Show object]
	 */
	DBConnector.prototype.getShow = function (showId, callback) {
		this.connection.get(showId, function (err, doc) {
			var showObj = null;
			
			if (err === null) {
				showObj = new Show();
				showObj.fill(doc);
			}

			callback.call(this, showObj);
		});
	};
	/**
	 * Insert new show and returns related document
	 * @param  {[Show]}   show     [Show object]
	 * @param  {Function} callback [return function]
	 */
	DBConnector.prototype.insertShow = function (show, callback) {
		// Create the document
		var doc = show.data;
		doc.docType = "show";
		this.connection.put(doc, function (err, doc) {
			var response = true;
			if (err) {
				console.log("ERROR INSERTING SHOW: " + err);
				response = false;
			}
			callback.call(this, response);
		});
	};

	DBConnector.prototype.updateShow = function (show) {
		// body...
	};

	DBConnector.prototype.removeShow = function (show, callback) {
		// Get document associated
		var doc = show.data;
		this.connection.remove(doc, function (err, response) {
			if (err) {
				console.log("ERROR REMOVING SHOW (" + docId + "): " + err);
			}
			callback.call(this, response.ok);
		});
	};

	window.DBConnector = DBConnector;
}(window)); // Esto hace que se ejecute automaticamente
/**
 * Episode class
 * Contains all info about an episode, even if it's been watched
 * This is to be used in Show objects
 */
(function(window) {
	function Episode() {
		this.data = { // Serializable
			season: null, // Number of the season
			number: null, // Number of the episode in the season
			name: null, // Name of the episode (string)
			overview: "",
			airDate: null, // Date when it was or will be aired
			watched: false // If it's been watched by the user
		};
	}
	window.Episode = Episode;
}(window));
/**
 * Show class
 * Contains info about a show, including episodes
 */
(function(window) {
	function Show() {
		this.data = { // Serializable
			_id: null, // Id from TVDB
			name: null, // Name of the show
			language: null, // Language indicated in TVDB
			banner: "", // Banner image (points to url)
			overview: "", // Short description of the show
			firstAired: null, // Date of the premiere
			network: "", // TV network channel where is aired
			imdbId: null, // IMDB Id
			seasons: 0, // Number of seasons
			episodes: [], // Array containing all episodes (Episode class)
			watchedEpisodes: 0 // Count of watched episodes
		};
	}
	/**
	 * Fills Shows with new info
	 */
	Show.prototype.fill = function(newData) {
		this.data = newData;
	};
	window.Show = Show;
}(window));
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
			if (show.data.episodes[i].season === seasonNumber && show.data.episodes[i].number === episodeNumber) {
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
						var seasonName = "Season " + currentSeason;
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
 * Syncs local data with TVDB
 */
function updateData() {}
/**
 * Retrieve user data from file
 */
function importUserData(callback) {
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
	/*var jsonString = JSON.stringify(showsArray);
	fs.writeFile("../src/user-data.json", jsonString, {
		encoding: 'utf8'
	}, function(err) {
		if (err) {
			console.log("Error saving data file: " + err);
		}
	});*/
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
		goToSection("calendar");
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
function createCalendarDays(month, year) {
	"use strict";
	var tableBody = $("#calendar__table--tbody"),
		weekRow = "",
		firstDate = new Date(year, month, 1), // First date of month
		lastDate = new Date(year, month + 1, 0), // Last date of month
		daysInMonth = lastDate.getDate(), // Total days in month
		weekDayCount = 0;
	// First clear calendar
	$(tableBody).html("");
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
		weekRow += "<td data-date=\"" + year + "-" + month + "-" + j + "\"><span class=\"calendar__cell__header\">" + j + "</span></td>";
		weekDayCount++;
		if (weekDayCount > 6) { // New week
			weekDayCount = 0;
			weekRow += "</tr>";
			tableBody.append(weekRow);
			if (j + 1 < daysInMonth) {
				weekRow = "<tr>"; // Start new row
			}
		}
	}
	while (weekDayCount != 1) {
		weekRow += "<td data-date=\"\"><span class=\"calendar__cell__header\"> </span></td>";
		weekDayCount++;
		// Close week and month
		if (weekDayCount > 6) {
			weekDayCount = 1;
			weekRow += "</tr>";
			tableBody.append(weekRow);
		}
	}
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
				$(tdDay).append("<div class=\"calendar__episode\">" + "<input id=" + cbId + " name=\"" + episode.data._id + "\" data-show=" + show.data._id + " type=\"checkbox\" />" + "<label for=" + cbId + ">" + show.data.name + "</label><br>" + "<label for=" + cbId + ">" + episode.data.name + "</label>" + "</div>");
				// Set event and state for the checkbox
				var cb = $("input[id='" + cbId + "']");
				$(cb).click(function(event) {
					console.log("click!");
					console.log(this.getAttribute("data-show"));
					console.log(getShowById(this.getAttribute("data-show")));
					currentShow = getShowById(this.getAttribute("data-show"));
					console.log(currentShow);
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
	dbConnector.connect("showtracker");

	/*dbConnector.getInfo(function(info){
		console.log(info);
	});	*/

	// Initialize API
	currentSection = "calendar";
	// Hide all sections
	$(".article--main").hide();
	// Set listeners for most buttons
	setEventListeners();
	// Import data from Episode Calendar using json file
	//importUserData(fillAllShows);
	// Loads data from file an+d checks for updates
	//loadLocalData();
	retrieveUserShows();
	updateData();
	// Create calendar
	createCalendarDays(currentDate.getMonth(), currentDate.getFullYear());
	// Show main section, calendar
	goToSection("calendar");
});
