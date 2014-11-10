/*global console*/
var $ = window.$,
	currentSection = "calendar", // Active section of the page
	currentShow = null, // Show displaying information, easier for adding to collection
	showsArray = []; // All user shows with some info like watched episodes
/**
 * TVDB
 */
var API_KEY = "01C061EC44C068BD", // API key from TVDB
	serverTime; // Time in TVDB server in last check
/**
 * Gets server time
 */
function retrieveServerTime() {
	"use strict";
	$.ajax({
		type: "POST",
		url: "http://thetvdb.com/api/Updates.php?type=none",
		async: true,
		dataType: "xml",
		// Success
		success: function(data) {
			// Parse XML just in case there is any error
			serverTime = $(data).find("Time").text();
		},
		// Error
		error: function(xhr, status, error) {
			console.error("There was a problem retrieving server time:\n" + xhr.responseText);
		}
	});
}

function onShowClick(event) {
	"use strict";
	event.preventDefault();
	console.log(event.target.getAttribute("name"));
	displayShowInfo(event.target.getAttribute("name"));
}
/**
 * Retrieve show info and show it
 * @param  {[int]} showId [Id of the show to search for]
 */
function displayShowInfo(showId) {
	"use strict";
	$.ajax({
		type: "POST",
		/*url: "http://thetvdb.com/api/GetSeries.php?seriesname=" + showId,*/
		url: "http://thetvdb.com/data/series/" + showId + "/all/",
		async: true,
		dataType: "xml",
		// Success
		success: function(data) {
			if ($(data).text().trim() === "") {
				$("#modalSeriesNotFound").foundation("reveal", "open");
				return;
			}
			var inCollection = isInCollection($(seriesInfo).find("SeriesName").text()),
				seriesInfo = $(data).find("Series")[0];
			// GENERAL INFO
			// Get show info
			currentShow = new Show();
			currentShow.id = showId;
			currentShow.name = $(seriesInfo).find("SeriesName").text();
			currentShow.overview = $(seriesInfo).find("Overview").text();
			currentShow.firstAired = $(seriesInfo).find("FirstAired").text();
			currentShow.network = $(seriesInfo).find("Network").text();
			// Set page info
			$("#showInfoName")[0].textContent = currentShow.name;
			$("#showInfoOverview")[0].textContent = currentShow.overview;
			$("#showInfoFirstAired")[0].textContent = currentShow.firstAired;
			$("#showInfoNetWork")[0].textContent = currentShow.network;
			// SEASONS AND EPISODES
			// Cleanup
			$("#showInfo_seasons_tabs").html("");
			$("#showInfo_seasons_eps").html("");
			// Retrieve episodes info and print it
			var currentSeason = -1;
			$(data).find("Episode").each(function() {
				var season = parseInt($(this).find("SeasonNumber").text()),
					htmlContent = "";
				// SEASON
				if (currentSeason < season) {
					currentSeason = season;
					// Create new season tab and table
					htmlContent = "<dd><a href='#showInfo_seasons_eps-" + currentSeason +
															"'>Season " + currentSeason + "</a></dd>";
					$("#showInfo_seasons_tabs").append(htmlContent);

					htmlContent = "<div class=\"content\" id=\"showInfo_seasons_eps-" + currentSeason +
									"\"><table id=\"showInfo_seasons_eps-table-" + currentSeason +
									"\" class=\"small-12 column\">" +
									"<thead><tr><th>Episode</th><th>Name</th><th>Description</th><th>Watched</th></tr></thead>" +
									"<tbody></tbody></table>" +
									"</div>";
					$("#showInfo_seasons_eps").append(htmlContent);
				}
				// EPISODE
				var episode = new Episode();
				episode.name = $(this).find("EpisodeName").text();
				episode.overview = $(this).find("Overview").text();
				episode.season = season;
				episode.number = parseInt($(this).find("EpisodeNumber").text());
				episode.airDate = $(this).find("EpisodeName").text();
				currentShow.episodes.push(episode);

				// Get the tbody of the table in the current season tab
				htmlContent = "<tr><td>" + episode.number + "</td>" +
								"<td>" + episode.name + "</td>" +
								"<td>" + episode.overview + "</td></tr>";
				
				$("#showInfo_seasons_eps-table-"+currentSeason+" tbody").append(htmlContent);

				
			});
			//$("#showInfo_seasons_eps-table-"+0+" tbody").append("<tr><td>dsnfdjsf</td><td>jfnsdj sdnfj sdnfjsd nfs</td></tr>");

			// Set the add/remove button
			if (inCollection) {
				$("#showInfo__button--add").hide();
				$("#showInfo__button--remove").show();
			} else {
				$("#showInfo__button--add").show();
				$("#showInfo__button--remove").hide();
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
function isInCollection(showName) {
	for (var i = 0; i < showsArray.length; i++) {
		if (showsArray[i].name === showName) {
			return true;
		}
	}
	return false;
}
/**
 * Prints a list of all series in user collection
 */
var fillAllShows = function fillAllShowsF() {
	"use strict";
	var showsCount = showsArray.length,
		showListRows = $("#showListRows");
	// Clear list
	$(showListRows).html("");
	$("#myshows h2")[0].textContent = "You are following " + showsCount + " shows";
	// List shows
	if (showsCount > 0) {
		for (var i = 0; i < showsCount; i++) {
			var row = document.createElement("tr"),
				cell = document.createElement("td"),
				link = document.createElement("a");
			// First col
			link.textContent = showsArray[i].name;
			$(link).click(onShowClick);
			// Save the TVDB Id of the show to get the complete info later
			link.setAttribute("name", showsArray[i].id);
			cell.appendChild(link);
			row.appendChild(cell);
			// Second col
			cell = document.createElement("td");
			cell.textContent = "Watched " + showsArray[i].watchedEpisodes + " out of " + showsArray[i].episodes.length + " episodes.";
			row.appendChild(cell);
			showListRows.append(row);
		}
	}
};
/**
 * Load local data from user file
 */
function loadLocalData() {
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
				show.id = data[i].id;
				show.name = data[i].show;
				// Get all episodes from this show
				while (i < data.length && data[i].show === show.name) {
					episode = new Episode();
					episode.name = data[i].name;
					episode.season = data[i].season;
					episode.number = data[i].number;
					episode.airDate = data[i].air_date;
					episode.watched = (data[i].watched === "true");
					// Save episode to show
					show.episodes.push(episode);
					if (episode.watched === true) {
						show.watchedEpisodes++;
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
			console.error(error);
			$("#modalLocalDataError").foundation("reveal", "open");
		}
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
				show.name = data[i].show;
				// Get all episodes from this show
				while (i < data.length && data[i].show === show.name) {
					episode = new Episode();
					episode.name = data[i].name;
					episode.season = data[i].season;
					episode.number = data[i].number;
					episode.airDate = data[i].air_date;
					episode.watched = (data[i].watched === "true");
					// Save episode to show
					show.episodes.push(episode);
					if (episode.watched === true) {
						show.watchedEpisodes++;
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
		url: "http://thetvdb.com/api/GetSeries.php?seriesname=" + name,
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
				console.log($(this).find('seriesid').text());
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
 * Adds a show to the user collection
 */
function addToCollection(show) {
	if (show !== null) {
		showsArray.push(show);
		// Refill shows table
		fillAllShows();
		$("#showInfo__button--add").hide();
		$("#showInfo__button--remove").show();
	}
}
/**
 * Adds a show to the user collection
 */
function removeFromCollection(show) {
	if (show !== null) {
		for (var i = 0; i < showsArray.length; i++) {
			if (showsArray[i].name === show.name) {
				showsArray.splice(i, 1);
				// Refill shows table
				fillAllShows();
				$("#showInfo__button--add").show();
				$("#showInfo__button--remove").hide();
				return;
			}
		}
	}
}
/**
 * Wait for DOM elements to be loaded and ready
 */
$(document).ready(function(argument) {
	"use strict";
	// Initialize API
	//initDataProcessing();
	currentSection = "calendar";
	// Hide all sections
	$(".article--main").hide();
	// Event listeners, use wrapper functions to pass argument
	$("#menu--main__search--button").click(function(e) {
		e.preventDefault();
		searchShows($("#menu--main__search--input").val());
	});
	$("#menu--main__calendar").click(function(e) {
		e.preventDefault();
		goToSection("calendar");
	});
	$("#menu--main__unwatched").click(function(e) {
		e.preventDefault();
		goToSection("unwatched");
	});
	$("#menu--main__myshows").click(function(e) {
		e.preventDefault();
		goToSection("myshows");
	});
	$("#showInfo__button--add").click(function(e) {
		addToCollection(currentShow);
	});
	$("#showInfo__button--remove").click(function(e) {
		removeFromCollection(currentShow);
	});
	// Import data from Episode Calendar using json file
	//importUserData(fillAllShows);
	// Loads data from file and checks for updates
	loadLocalData();
	updateData();
	// Show main section, calendar
	goToSection("calendar");
});