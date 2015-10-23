var _ = require('lodash');
var createTidepoolClient = require('tidepool-platform-client');
var Shimmer = require('shimmer-client');

//DEBUG = false;

function Mussel(shimmerConfig, tidepoolConfig) {
	this.shimmer = new Shimmer(shimmerConfig);
	console.log('tpconfig:'+tidepoolConfig)
	
	tidepoolConfig.metricsSource = '';
	tidepoolConfig.metricsVersion = '';
	this.tidepool = createTidepoolClient(tidepoolConfig);

	this.uploaderDetails = tidepoolConfig.uploaderDetails;
	
}

Mussel.prototype.login = function(cb) {
	
	this.tidepool.login({username:this.uploaderDetails.uploaderLogin, password:this.uploaderDetails.uploaderPassword}, {remember:false}, function(err, response) {
		if (err) {
			console.log('Error logging in');
			return cb(err);
		} else {
			console.log('logged in:');
			console.log(response);
			return cb(null, response);
		}
	});
}

Mussel.prototype.syncNewActivityData = function(omhUser, shim, tpUserId, cb) {
	this.login(function(err, response) {
		if (err) {
			console.log(err);
		} else {
			this.getLastActivity(tpUserId, function(err, fromDate) {
				//work around for bug with jawbone, where date from last day is not returned. fixed in next version. remove when new docker containers are released
				var todayPlus1 = new Date();
				todayPlus1.setDate(todayPlus1.getDate()+1);
				todayPlus1 = todayPlus1.toJSON();
				this.uploadPhysicalActivityData(omhUser, shim, fromDate.toJSON(), todayPlus1, tpUserId, cb);
			}.bind(this));
		}
	}.bind(this));
}

Mussel.prototype.uploadPhysicalActivityData = function(omhUser, shim, fromDate, toDate, tpUserId, cb) {
	this.login(function(err, response) {
		if (err) {
			console.log(err);
		} else {
			this.getActivityNotes(omhUser, shim, fromDate, toDate, function(err, response) {
				if (err) {
					console.log(err);
				} else {
					this.writeActivityNotes(response, tpUserId, this.uploaderDetails.uploaderUserId, function(err, response) {
						if (err) {
							console.log(err);
						} else {
							console.log(response);
						}
					}.bind(this));
				}
			}.bind(this));
			
		}
	}.bind(this));
}

/**
* Gets activity data in an Open mHealth compliant format from an instance of Shimmer
*/
Mussel.prototype.getActivityData = function(omhUser, shim, fromDate, toDate, cb) {
	//shimmer.getActivityData('nosh', 'activity', 'jawbone', fromDate, toDate, _.bind(this.transformActivitiesToNotes, this))
	this.shimmer.getActivityData(omhUser, 'activity', shim, fromDate, toDate, cb);
	return;
}

/*
* Gets activity data from an instance of Shimmer converted to TidePool notes
*/
Mussel.prototype.getActivityNotes = function(omhUser, shim, fromDate, toDate, cb) {
	this.getActivityData(omhUser, shim, fromDate, toDate, _.bind(function(err, response) {
		if (err) {
			console.log(err);
		} else {
			console.log(response);
			this.transformActivitiesToNotes(response, cb);
		}
	}, this));
}

Mussel.prototype.transformActivitiesToNotes = function(activities, cb) {
	console.log('activities:')
	console.log(activities);
	var activities;
	var activityArr = activities.body;
	var notes = [];
	for (var i=0; i< activityArr.length; i++) {
		var omhSchema = {};
		
		omhSchema.activity = activityArr[i].body.activity_name;
		omhSchema.reported_activity_intensity = activityArr[i].body.reported_activity_intensity;
		omhSchema.distance = activityArr[i].body.distance;
		omhSchema.effective_time_frame = activityArr[i].body.effective_time_frame;
		omhSchema.acquisition_provenance = activityArr[i].header.acquisition_provenance.source_name;

		omhSchemaText = JSON.stringify(omhSchema, null, 2);
		console.log("Activity:"+i+":");
		console.log(omhSchemaText);
		
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

		//console.log("TIMESTAMP:"+noteTs);
		var note = {};
		var msg = {
			messagetext:"#physical-activity\n\r         "+noteText+'              \n\r'+'',//omhSchemaText,
			timestamp:omhSchema.effective_time_frame.time_interval.start_date_time
		}
		notes.push(msg);
	}
	
	return cb(null, notes);
}

Mussel.prototype.getLastActivity = function(userid, cb) {
	this.tidepool.getNotesForUserWithPattern(userid, null, /#physical-activity/, function(err, response){
		if (err) {
			console.log("error:");console.log(err);
			return cb(err);
		} else {
			console.log('received notes');

			//if we don't find any, then return two months ago
			var lastSyncedTime =  new Date();
			lastSyncedTime.setMonth(lastSyncedTime.getMonth()-2);
			console.log("default last note:"+lastSyncedTime);
			
			var notes = response;
			for (var i=0; i< notes.length; i++) {
				if (new Date(notes[i].timestamp) > lastSyncedTime) {
					lastSyncedTime = new Date(notes[i].timestamp);
					console.log("last note:"+lastSyncedTime);
				}
			}
			return cb(null, lastSyncedTime);
		}
	});
}

Mussel.prototype.writeActivityNotes = function(notes, noteForUserId, noteByUserId, cb) {
	for (var i=0; i < notes.length; i++) {
		notes[i].userid = noteByUserId;
		notes[i].groupid = noteForUserId;
			this.tidepool.startMessageThread(notes[i], cb);
	}
}

Mussel.prototype.getUsers = function(cb) {
	this.shimmer.getUsers(cb);
}

Mussel.prototype.deleteActivityNotes = function(userid, cb) {
	console.log('preparing to delete notes for:'+userid);
	this.login(function(err,response) {

		this.tidepool.getNotesForUserWithPattern(userid, null, /#physical-activity/, function(err, response){
			if (err) {
				console.log("error:");console.log(err);
			} else {
				console.log('received notes');
				//var notes = JSON.parse(response);
				var notes = response;
				for (var i=0; i< notes.length; i++) {
					console.log('note '+i+' msg:'+ notes[i].messagetext);
					this.tidepool.deleteMessage(notes[i].id, cb);
				}
			}
		}.bind(this));
	}.bind(this));
}

Mussel.prototype.getAuths = function(user, cb) {
	this.shimmer.getAuths(user, cb);
}

Mussel.prototype.deauthorize = function(shim, user, cb) {
	this.shimmer.deauthorize(shim, user, cb);
}

function done(err, response) {
	if (err != null) {
		console.log(err)
	} else {
		console.log('****In callback:')
		//console.log('handles:')
		console.log(response);
		//console.log(process._getActiveHandles());
		//process.exit();
	}

	return;
}

module.exports = Mussel;
