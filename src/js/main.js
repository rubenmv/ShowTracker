var currentDateTime, // Today
	currentMonth = 1; // Month showing in calendar

/**
 * Show class
 * @param {[type]} title     [description]
 * @param {[type]} unwatched [description]
 */
function Show (title, unwatched) {
	this.title = title;
	this.unwatched = unwatched;
};
/**
 * Initialize application
 */
function init() {
	currentDateTime = new Date();
}

/**
 * Retrieve user data from file
 */
function getUserData() {
	$.ajax({
		type: "POST",
		url: "user-data.json",
		async: true,
		dataType: "json",
		// Success
		success: function(data) {
			var showArray = [],
				currentShow = data[0].show,
				showsCount = 0, // Total of shows in collection
				episodeCount = 0, // Total of show episodes
				watchedCount = 0; // Watched episodes per show

			var showListInfo = document.getElementById("showListInfo");
			// For every show, save name and watched episodes
			for (var i = 0; i < data.length; i++) {
				if (data[i].show === currentShow) {
					// Check episode watched
					if (data[i].watched === "true") {
						watchedCount++;
					}
					episodeCount++;
				} else {
					var row = document.createElement('tr'),
						cell = document.createElement('td'),
						link = document.createElement('a');

					cell.textContent = currentShow;
					row.appendChild(cell);
					cell = document.createElement('td');
					cell.textContent = "Watched " + watchedCount + " out of " + episodeCount + " episodes.";
					row.appendChild(cell);

					showListInfo.appendChild(row);

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
			console.error("There was a problem retrieving user data:\n" + xhr.responseText);
		}
	});
}
/**
 * Wait for DOM elements to be loaded and ready
 */
$(document).ready(function(argument) {
	init();
	getUserData();
});