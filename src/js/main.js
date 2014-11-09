/*global console*/
var $ = window.$,
	currentSection; // Active section of the page
var API_KEY = "01C061EC44C068BD"; // API key from TVDB
/**
 * Show class
 * @param {[string]} title     [title of the show]
 * @param {[number]} unwatched [Unwatched episodes count]
 */
function Show(title, unwatched) {
	'use strict';
	this.title = title;
	this.unwatched = unwatched;
}
/**
 * Retrieve show info and show it
 * @param  {[Object]} event [Event triggered]
 */
function displayShowInfo(event) {
	event.preventDefault();
	// Fill show info
	$('#showInfo h2')[0].textContent = event.target.textContent;
	// Show info section
	goToSection('showInfo');
}
/**
 * Retrieve user data from file
 */
function getUserData() {
	'use strict';
	$.ajax({
		type: 'POST',
		url: 'user-data.json',
		async: true,
		dataType: 'json',
		// Success
		success: function(data) {
			var showArray = [],
				currentShow = data[0].show,
				showsCount = 0, // Total of shows in collection
				episodeCount = 0, // Total of show episodes
				watchedCount = 0; // Watched episodes per show
			var showListInfo = $('#showListInfo');
			// For every show, save name and watched episodes
			for (var i = 0; i < data.length; i++) {
				if (data[i].show === currentShow) {
					// Check episode watched
					if (data[i].watched === 'true') {
						watchedCount++;
					}
					episodeCount++;
				} else {
					var row = document.createElement('tr'),
						cell = document.createElement('td'),
						link = document.createElement('a');
					// First col
					link.textContent = currentShow;
					$(link).click(displayShowInfo);
					cell.appendChild(link);
					row.appendChild(cell);
					// Second col
					cell = document.createElement('td');
					cell.textContent = 'Watched ' + watchedCount + ' out of ' + episodeCount + ' episodes.';
					row.appendChild(cell);
					showListInfo.append(row);
					// New show found, add current and reset count
					showArray.push(new Show(currentShow, watchedCount));
					watchedCount = 0;
					episodeCount = 0;
					// Start with the new show
					currentShow = data[i].show;
				}
			}
		},
		// Error
		error: function(xhr, status, error) {
			console.error('There was a problem retrieving user data:\n' + xhr.responseText);
		}
	});
}
/**
 * Hides current section and shows called section
 * @param {[string]} section [Name of the section]
 */
function goToSection(section) {
	'use strict';
	// Update main menu state
	$('#menu--main__' + currentSection).removeClass('active');
	$('#menu--main__' + section).addClass('active');
	// Hide current section and show new section
	$('#' + currentSection).fadeOut('fast', function() {
		$('#' + section).fadeIn('fast');
		// Make new section the current one
		currentSection = section;
	});
}
/**
 * Wait for DOM elements to be loaded and ready
 */
$(document).ready(function(argument) {
	'use strict';
	currentSection = 'calendar';
	// Hide all sections
	$('.article--main').hide();
	// Event listeners, use wrapper functions to pass arguments
	$('#menu--main__calendar').click(function(e) {
		e.preventDefault();
		goToSection('calendar');
	});
	$('#menu--main__unwatched').click(function(e) {
		e.preventDefault();
		goToSection('unwatched');
	});
	$('#menu--main__shows').click(function(e) {
		e.preventDefault();
		goToSection('myshows');
	});
	// Retrieve local stored data
	getUserData();
	// Show main section, calendar
	goToSection('calendar');
});