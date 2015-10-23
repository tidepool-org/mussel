var Mussel = require('./index.js');
var express = require("express");
var app = express();

app.get("/auths/:userid", function(req, res) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "X-Requested-With");
	var auths = mussel.getAuths(req.params.userid, function(err, response) {
	if (err) {
		console.log('error:'+err);
		res.send(error);
	} else {
		console.log(response);
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
			console.log('error:'+err);
			res.send(err);
		} else{
			console.log(response);
			res.send(response);
		}
	});

});

var SHIMMER_HOST=process.env.SHIMMER_HOST

var TIDEPOOL_HOST=process.env.TIDEPOOL_HOST
var TIDEPOOL_UPLOAD_HOST=process.env.TIDEPOOL_UPLOAD_HOST

var UPLOADER_LOGIN=process.env.UPLOADER_LOGIN
var UPLOADER_PASSWORD=process.env.UPLOADER_PASSWORD
var UPLOADER_USERID=process.env.UPLOADER_USERID


var tidepoolConfig = {
			host: TIDEPOOL_HOST,
		  	uploadApi: TIDEPOOL_UPLOAD_HOST,
		  	uploaderDetails: {uploaderLogin:UPLOADER_LOGIN, uploaderPassword:UPLOADER_PASSWORD, uploaderUserId: UPLOADER_USERID  }
		  	};
var shimmerConfig = {'host':SHIMMER_HOST};


console.log('TidePool Config:');
console.log(tidepoolConfig);
console.log('\n');
console.log('Shimmer Config:')
console.log(shimmerConfig);

function syncActivities() {
	
	var mussel = new Mussel(shimmerConfig, tidepoolConfig);
	var users = mussel.getUsers(function(err, users){
		if (err) {
			console.log('error:'+err);
		} else {
			console.log(users);
			for (var i=0; i< users.length; i++) {
				var omhUser = users[i].username;

				var split = omhUser.split('|');
				if (split < 3 || split[0] != 'tp') {
					//ignore records that are not in proper format
					break;
				}
				var tpUserId = split[1];
				//only support single device authorization for now
				for (var j=0; j< users[i].auths.length; j++) {
					var shim = users[i].auths[j];

					console.log('\nSyncing data for Tidepool user:'+tpUserId);
					console.log('Syncing from OMH user:'+omhUser);
					console.log('For Device:'+shim+'\n\n');
					mussel.syncNewActivityData(omhUser, shim, tpUserId);
				}
			}
		}
	});
}




function done(err, response) {
	if (err != null) {
		console.log(err)
	} else {
		//console.log('handles:')
		console.log(response);
		//console.log(process._getActiveHandles());
		//process.exit();
	}

	return;
}
var mussel = new Mussel(shimmerConfig, tidepoolConfig);

switch(process.argv[2]) {
	case 'sync':
		console.log('Syncing activities');
		exitAfter(30000);
		syncActivities();
		break;
	case 'delete':
		console.log('Deleting activity notes');
		exitAfter(30000);
		mussel.deleteActivityNotes(process.argv[3], done);
		//0e5fab3f1a
		break; 
	case 'service':
		var port = process.env.PORT || 5000;
		 app.listen(port, function() {
		   console.log("Listening on " + port);
		 });
		 break;
	default:
		console.log('Incorrect arguments');
		console.log('Usage:');
		console.log('node musselrunner.js sync');
		console.log('or');
		console.log('node musselrunner.js delete userid');
		console.log('or');
		console.log('node musselrunner.js service');

}

function exitAfter(millis) {
	setTimeout(function() {
				console.log('exiting');
				process.exit();
			}, millis);
}



