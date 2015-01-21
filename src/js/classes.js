/********************************
 * CLASSES
 ********************************/
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
	 * Shows Database info
	 */
	DBConnector.prototype.getInfo = function() {
		this.connection.info().then(function(info) {
			console.log(info);
		}).catch(function (err) {
			console.error("getInfo(). PROBLEM RETRIEVING DB INFO\n" + err);
		});
	};
	/**
	 * Retrieves all documents from database
	 * @param  {Function} callback [description]
	 * @return {[type]}            [description]
	 */
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
	/**
	 * Removes show document from database
	 * @param  {[Show]}   show     [show to be removed]
	 * @param  {Function} callback [Returns confirmation]
	 */
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
			_id: null,
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