'use strict';

var Mussel = require('./index.js');
var express = require("express");
var schedule = require('node-schedule');

var bunyan = require('bunyan');
var log = bunyan.createLogger({name: "musselrunner"});

var app = express();

app.get("/auths/:userid", function(req, res) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "X-Requested-With");
	var auths = mussel.getAuths(req.params.userid, function(err, response) {
	if (err) {
		log.warn(err, "Error getting authorizations");
		res.status(500).send({ error: 'unable to retrieve auths', errorMsg:err });
	} else {
		res.send(response);
	}
	});
});

app.get("/deauthorize/:shim", function(req, res) {
	var username = req.query.username;
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "X-Requested-With");
	mussel.deauthorize(req.params.shim, username, function(err, response) {
		if (err) {
			log.warn(err, "Error deauthorizing");
			res.status(500).send({ error: 'unable to deauthorize', errorMsg:err });
		} else{
			res.send(response);
		}
	});

});

var SHIMMER_HOST=process.env.SHIMMER_HOST;

var TIDEPOOL_HOST=process.env.TIDEPOOL_HOST;
var TIDEPOOL_UPLOAD_HOST=process.env.TIDEPOOL_UPLOAD_HOST;

var UPLOADER_LOGIN=process.env.UPLOADER_LOGIN;
var UPLOADER_PASSWORD=process.env.UPLOADER_PASSWORD;
var UPLOADER_USERID=process.env.UPLOADER_USERID;

var MUSSEL_POLL_INTERVAL_MINUTES=process.env.MUSSEL_POLL_INTERVAL_MINUTES;

var polling

var tidepoolConfig = {
			host: TIDEPOOL_HOST,
		  	uploadApi: TIDEPOOL_UPLOAD_HOST,
		  	uploaderDetails: {uploaderLogin:UPLOADER_LOGIN, uploaderPassword:UPLOADER_PASSWORD, uploaderUserId: UPLOADER_USERID  }
		  	};
var shimmerConfig = {'host':SHIMMER_HOST};

log.info('TidePool Config:');
log.info(tidepoolConfig);
log.info('Shimmer Config:');
log.info(shimmerConfig);

function syncActivities() {
	
	var mussel = new Mussel(shimmerConfig, tidepoolConfig);
	var users = mussel.getUsers(function(err, users){
		if (err) {
			log.warn(err, "Error getting users");
		} else {
			log.info(users);
			for (var i=0; i< users.length; i++) {
				var omhUser = users[i].username;

				var split = omhUser.split('|');
				if (split < 3 || split[0] != 'tp') {
					//ignore records that are not in proper format
					continue;
				}
				var tpUserId = split[1];
				log.info('\nSyncing data for Tidepool user:'+tpUserId);
				
				for (var j=0; j< users[i].auths.length; j++) {
					var shim = users[i].auths[j];
					syncUser(omhUser, shim, tpUserId);
				}
			}
		}
	});
}

function syncUser(omhUser, shim, tpUserId) {
	log.info('\nSyncing data for Tidepool user:'+tpUserId);
	log.info('Syncing from OMH user:'+omhUser);
	log.info('For Device:'+shim+'\n\n');
	mussel.syncNewActivityData(omhUser, shim, tpUserId, done);
}

function done(err, response) {
	if (err != null) {
		console.log(err);
	} else {
		//console.log('handles:')
		console.log(response);
		//console.log(process._getActiveHandles());
		//process.exit();
	}

	return;
}
var mussel = new Mussel(shimmerConfig, tidepoolConfig);

mussel.login(function(err, response) {
switch(process.argv[2]) {
	case 'sync':
		console.log('Syncing activities');
		exitAfter(30000);
		syncActivities();
		break;
	case 'syncuser':
		syncUser(process.argv[3], process.argv[4], process.argv[5]);
		exitAfter(30000);
		break;
	case 'delete':
		console.log('Deleting activity notes');
		exitAfter(30000);
		mussel.deleteActivityNotes(process.argv[3], done);
		break; 
	case 'service':
		var port = process.env.MUSSEL_PORT || 5000;
		app.listen(port, function() {
		   console.log("Listening on " + port);
		 });
		var pollingSchedule= '*/'+MUSSEL_POLL_INTERVAL_MINUTES+' * * * *';
		log.info('polling schedule:'+pollingSchedule);
		var j = schedule.scheduleJob(pollingSchedule, syncActivities);
		break;
	default:
		console.log('Incorrect arguments');
		console.log('Usage:');
		console.log('node musselrunner.js sync');
		console.log('or');
		console.log('node musselrunner.js syncuser omhUserid, shim, tidepoolUserId');
		console.log('or');
		console.log('node musselrunner.js delete userid');
		console.log('or');
		console.log('node musselrunner.js service');

}
});

function exitAfter(millis) {
	setTimeout(function() {
				console.log('exiting');
				process.exit();
			}, millis);
}

var now = new Date();
var twoMonthsAgo = new Date();
twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 3);



