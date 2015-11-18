'use strict';

var _ = require('lodash');
var bunyan = require('bunyan');
var log = bunyan.createLogger({name: "mussel"});


var createTidepoolClient = require('tidepool-platform-client');
var Shimmer = require('shimmer-client');

function Mussel(shimmerConfig, tidepoolConfig) {
	this.shimmer = new Shimmer(shimmerConfig);
	
	tidepoolConfig.metricsSource = '';
	tidepoolConfig.metricsVersion = '';
	this.tidepool = createTidepoolClient(tidepoolConfig);

	this.uploaderDetails = tidepoolConfig.uploaderDetails;

	if (process.env.WRITE_ACTIVITY_OBJECTS == 'true') {
		this.writeActivityObjects = true;
	} else {
		this.writeActivityObjects = false;
	}

	//optionally either write activity objects or notes
	if (this.writeActivityObjects) {
		log.info('Writing activities to tidepool objects');
		this.getLastActivity = this.getLastActivity_FromObjects;
		this.getTPActivities = this.getTPActivities_FromObjects;
		this.writeTPActivities = this.writeTPActivities_ToObjects;
	} else {
		log.info('Writing activities to tidepool notes');
		this.getLastActivity = this.getLastActivity_FromNotes;
		this.getTPActivities = this.getTPActivities_FromNotes;
		this.writeTPActivities = this.writeTPActivities_ToNotes;
	}
	
}

Mussel.prototype.login = function(cb) {
	
	this.tidepool.login({username:this.uploaderDetails.uploaderLogin, password:this.uploaderDetails.uploaderPassword}, {remember:false}, function(err, response) {
		if (err) {
			log.warn(err, 'Error logging in');
			return cb(err);
		} else {
			log.debug(response, 'logged in:');
			return cb(null, response);
		}
	});
};

Mussel.prototype.syncNewActivityData = function(omhUser, shim, tpUserId, cb) {
	this.login(function(err, response) {
		if (err) {
			cb(err);
		} else {
			this.getLastActivity(tpUserId, shim, function(err, fromDate) {
				if (err) {
					log.warn(err, "Could not retrieve last activity");
					cb(err);
				} else {
					//work around for bug with jawbone, where date from last day is not returned. fixed in next version. remove when new docker containers are released
					var todayPlus1 = new Date();
					todayPlus1.setDate(todayPlus1.getDate()+1);
					todayPlus1 = todayPlus1.toJSON();
					this.uploadPhysicalActivityData(omhUser, shim, fromDate.toJSON(), todayPlus1, tpUserId, cb);
				}
			}.bind(this));
		}
	}.bind(this));
};

Mussel.prototype.uploadPhysicalActivityData = function(omhUser, shim, fromDate, toDate, tpUserId, cb) {
	this.login(function(err, response) {
		if (err) {
			cb(err);
		} else {
			this.getTPActivities(omhUser, shim, fromDate, toDate, function(err, response) {
				if (err) {
					cb(err);
				} else {
					this.writeTPActivities(response, tpUserId, this.uploaderDetails.uploaderUserId, function(err, response) {
						if (err) {
							cb(err);
						} else {
							cb(null, response);
						}
					}.bind(this));
				}
			}.bind(this));
			
		}
	}.bind(this));
};


/**
* Gets activity data in an Open mHealth compliant format from an instance of Shimmer
*/
Mussel.prototype.getActivityData = function(omhUser, shim, fromDate, toDate, cb) {
	this.shimmer.getActivityData(omhUser, 'activity', shim, fromDate, toDate, cb);
	return;
};

/*
* Gets activity data from an instance of Shimmer converted to TidePool notes
*/
Mussel.prototype.getTPActivities_FromNotes = function(omhUser, shim, fromDate, toDate, cb) {
	this.getActivityData(omhUser, shim, fromDate, toDate, _.bind(function(err, response) {
		if (err) {
			log.warn(err, "Could not retrieve activity data for %s %s", omhUser, shim);
			cb(err);
		} else {
			this.transformActivitiesToNotes(response, cb);
		}
	}, this));
};

Mussel.prototype.getTPActivities_FromObjects = function(omhUser, shim, fromDate, toDate, cb) {
	this.getActivityData(omhUser, shim, fromDate, toDate, _.bind(function(err, response) {
		if (err) {
			log.warn(err, "Could not retrieve activity data for %s %s", omhUser, shim);
			cb(err);
		} else {
			this.transformActivitiesToTidepoolActivities(response, cb);
		}
	}, this));
};

Mussel.prototype.transformActivitiesToTidepoolActivities = function(activities, cb) {
	
	var activityArr = activities.body;
	var tpActivityObjects = [];
	for (var i=0; i< activityArr.length; i++) {
		var activityTimestamp = new Date(activityArr[i].body.effective_time_frame.time_interval.start_date_time);
		
		// prepare common fields for Activities object
		var tpActivityObj = {
			"type":"physicalActivity",
			"subType": this.getShimKey(activityArr[i].header.acquisition_provenance.source_name),
			"time": activityTimestamp.toISOString(),
    		"timezoneOffset":-activityTimestamp.getTimezoneOffset(),
    		"conversionOffset":0,
    		"deviceId": "runkeeper-A1234", 
    		"uploadId": "0001"
    	};

    	delete activityArr[i].header.schema_id;
    	if (activityArr[i].body.effective_time_frame.time_interval.end_date_time) {
    		delete activityArr[i].body.effective_time_frame.time_interval.end_date_time;
    	}
    	//add data object
    	
    	tpActivityObj.datapoint = activityArr[i];
    	tpActivityObjects.push(tpActivityObj);
	}
	cb(null, tpActivityObjects);	
};

Mussel.prototype.getShimKey = function(source) {
	switch(source) { 
		case "Jawbone UP API":
			return "jawbone";
		case "Fitbit Resource API":
			return "fitbit";
		case "Runkeeper HealthGraph API":
			return "runkeeper";
		default:
			return "unknown shim";
	}
};

Mussel.prototype.transformActivitiesToNotes = function(activities, cb) {
	var activityArr = activities.body;
	var notes = [];
	for (var i=0; i< activityArr.length; i++) {
		var omhSchema = {};
		
		omhSchema.activity = activityArr[i].body.activity_name;
		omhSchema.reported_activity_intensity = activityArr[i].body.reported_activity_intensity;
		omhSchema.distance = activityArr[i].body.distance;
		omhSchema.effective_time_frame = activityArr[i].body.effective_time_frame;
		omhSchema.acquisition_provenance = activityArr[i].header.acquisition_provenance.source_name;

		var omhSchemaText = JSON.stringify(omhSchema, null, 2);
		
		//' at '+ omhSchema.effective_time_frame.time_interval.start_date_time+ 
		var noteText = omhSchema.activity+
					' for ' + omhSchema.effective_time_frame.time_interval.duration.value + ' ' + omhSchema.effective_time_frame.time_interval.duration.unit;
		var additionalText = '';
		if (omhSchema.distance == null) {
			additionalText = '(Reported intesity level - '+omhSchema.reported_activity_intensity+'). ';
		} else {
			additionalText = '('+omhSchema.distance.value+' '+omhSchema.distance.unit+'). ';
		}
		additionalText = additionalText+ 'Recorded by '+omhSchema.acquisition_provenance;

		noteText = noteText+' '+additionalText;

		var note = {};
		var msg = {
			messagetext:"#physical-activity\n\r         "+noteText+'              \n\r'+'',//omhSchemaText,
			timestamp:omhSchema.effective_time_frame.time_interval.start_date_time
		};
		notes.push(msg);
	}
	
	return cb(null, notes);
};

Mussel.prototype.getLastActivity_FromNotes = function(userid, device, cb) {
	this.tidepool.getNotesForUserWithPattern(userid, null, /#physical-activity/, function(err, response){
		if (err) {
			log.warn(err,"error getting last activity for:%s",userid);
			return cb(err);
		} else {

			//if we don't find any, then return two months ago
			var lastSyncedTime =  new Date();
			lastSyncedTime.setMonth(lastSyncedTime.getMonth()-2);
			
			var notes = response;
			for (var i=0; i< notes.length; i++) {
				if (new Date(notes[i].timestamp) > lastSyncedTime) {
					lastSyncedTime = new Date(notes[i].timestamp);
					log.info("last note: %s",lastSyncedTime);
				}
			}
			return cb(null, lastSyncedTime);
		}
	});
};

Mussel.prototype.getLastActivity_FromObjects = function (userId, device, cb) {
	var filters = {
		'type':'physicalActivity',
	 	'subtype':device
	 };
	this.tidepool.getFilteredDeviceData(userId, filters, function(err, response) {
		if (err) {
			cb(err);
		} else {
			var lastSyncedTime =  new Date();
			lastSyncedTime.setMonth(lastSyncedTime.getMonth()-2);
			var activities = response;
			for (var i=0; i< activities.length; i++) {
				if (new Date(activities[i].time) > lastSyncedTime) {
					lastSyncedTime = new Date(activities[i].time);
					log.info("last note: %s",lastSyncedTime);
				}
			}
			return cb(null, lastSyncedTime);
		}
	});
};


Mussel.prototype.writeTPActivities_ToObjects = function(objects, userId, userId2, cb) {
	for (var i=0; i < objects.length; i++) {
		log.info("submitting write to tidepool");
		this.tidepool.uploadDeviceDataForUser(userId, objects[i], cb);
	}
};

Mussel.prototype.writeTPActivities_ToNotes = function(notes, noteForUserId, noteByUserId, cb) {
	for (var i=0; i < notes.length; i++) {
		notes[i].userid = noteByUserId;
		notes[i].groupid = noteForUserId;
		this.tidepool.startMessageThread(notes[i], cb);
	}
};

Mussel.prototype.getUsers = function(cb) {
	this.shimmer.getUsers(cb);
};

Mussel.prototype.deleteActivityNotes = function(userid, cb) {
	log.info('preparing to delete notes for: %s',userid);
	this.login(function(err,response) {

		this.tidepool.getNotesForUserWithPattern(userid, null, /#physical-activity/, function(err, response){
			if (err) {
				cb(err);
			} else {
				var notes = response;
				for (var i=0; i< notes.length; i++) {
					this.tidepool.deleteMessage(notes[i].id, cb);
				}
			}
		}.bind(this));
	}.bind(this));
};

Mussel.prototype.getAuths = function(user, cb) {
	this.shimmer.getAuths(user, cb);
};

Mussel.prototype.deauthorize = function(shim, user, cb) {
	this.shimmer.deauthorize(shim, user, cb);
};


module.exports = Mussel;
