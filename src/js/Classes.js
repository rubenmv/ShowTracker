/*global window*/
/**
 * Episode class
 * Contains all info about an episode, even if it's been watched
 * This is to be used in Show objects
 */
(function(window) {
	// Constructor
	function Episode() {
		// Public
		this.id = null;
		this.season = null;	// Number of the season
		this.number = null;	// Number of the episode in the season
		this.name = null;		// Name of the episode (string)
		this.overview = "";
		this.airDate = null;	// Date when it was or will be aired
		this.watched = false;	// If it's been watched by the user
	}
	
	window.Episode = Episode;
}(window)); // Esto hace que se ejecute automaticamente

/**
 * Show class
 * Contains info about a show, including episodes
 */
(function(window) {
	// Constructor
	function Show() {
		// Public
		this.id = null;			// Id from TVDB
		this.name = null;			// Name of the show
		this.language = null;		// Language indicated in TVDB
		this.banner = "";		// Banner image (points to url)
		this.overview = "";		// Short description of the show
		this.firstAired = null;	// Date of the premiere
		this.network = "";		// TV network channel where is aired
		this.imdbId = null;		// IMDB Id
		this.seasons = 0;		// Number of seasons
		this.episodes = [];		// Array containing all episodes (Episode class)
		this.watchedEpisodes = 0;			// Count of watched episodes
	}
	
	window.Show = Show;
}(window)); // Esto hace que se ejecute automaticamente