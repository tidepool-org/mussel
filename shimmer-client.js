
//http://<host>:8083/data/{shim}/{endPoint}?username={userId}&dateStart=yyyy-MM-dd&dateEnd=yyyy-MM-dd&normalize={true|false}

//var request = require('request');
var request = require('superagent');

function Shimmer(config) {
  // always initialize all instance properties
  this.host = config.host;
  
}
// class methods
Shimmer.prototype.getActivityData = function(user, activity, shim, startDate, endDate, cb) {
	console.log("getting:"+activity+" data for:"+user+" from:"+shim+" for:"+startDate+" to "+endDate);

	var sd = startDate.substring(0,startDate.indexOf('T'));
	var ed = endDate.substring(0,endDate.indexOf('T'));
	var shimmerUri = this.host+'/data/'+shim+'/'+activity+'?username='+user+'&'+'dateStart='+sd+'&dateEnd='+ed;
	console.log(shimmerUri);
	request(shimmerUri, function (error, res) {
	  if (!error) {
	    //console.log(body)
	    var filteredActivities = [];
	    var activityObjects = res.body;//JSON.parse(body);
	    for (var i=0; i< activityObjects.body.length; i++) {

	    	// The Jawbone shim does not returning start date, so need to calculate it
			if (activityObjects.body[i].body.effective_time_frame.time_interval.start_date_time == null) {
				var startDateTime = new Date(activityObjects.body[i].body.effective_time_frame.time_interval.end_date_time);
				startDateTime.setSeconds(startDateTime.getSeconds()-activityObjects.body[i].body.effective_time_frame.time_interval.duration.value);
				activityObjects.body[i].body.effective_time_frame.time_interval.start_date_time = startDateTime.toISOString();
			}

			// Shimmer returns data from the start of the day portion of startDate, so need to filter out ones that are before our start time
			console.log("start date:"+startDate);
			console.log("activity date:"+activityObjects.body[i].body.effective_time_frame.time_interval.start_date_time);
			if (new Date(activityObjects.body[i].body.effective_time_frame.time_interval.start_date_time) > new Date(startDate)) {
				filteredActivities.push(activityObjects.body[i]);
			} else {
				console.log('***excluding');
			}

	    }
	    activityObjects.body = filteredActivities;
	    cb(null, activityObjects);
	  } else {
	  	console.log("error:"+error)
	  	cb(error);
	  }
	})
};

Shimmer.prototype.getUsers = function(cb) {
	console.log('retrieving user details');
	var shimmerUri = this.host+'/authorizations?username=';
	request(shimmerUri, function (error, res) {
	  if (!error) {
	    //console.log(body)
	    var users = res.body;//JSON.parse(body);
	    cb(null, users);
	  } else {
	  	console.log("error:"+error)
	  	cb(error);
	  }
	});
};

Shimmer.prototype.getConfiguredShims = function(cb) {
	console.log('retrieving active shims');
	var shimmerUri = this.host+'/registry';
	console.log(shimmerUri);
	request(shimmerUri, function (error, res) {
	  if (!error) {
	    //console.log(body)
	    var registry = res.body;//JSON.parse(res);
	    cb(null, registry);
	  } else {
	  	console.log("error:"+error)
	  	cb(error);
	  }
	});
}

Shimmer.prototype.getAuths = function(user, cb) {
	//console.log('retrieving authorization details for:'+user+ ' shim:'+shim);
	
	
	this.getConfiguredShims(function(err, registry) {
		function processAuth(shimKey, shimName) {
		return function (error, res) {
			  if (!error) {
			    var auth = res.body;//JSON.parse(body);
			   	auth.shimKey = shimKey;
			   	auth.shimName = shimName;
			    if (auth.isAuthorized) {
			    	auth.deauthURL = '';
			    }
			    auths.push(auth);
			    if ((auths.length) == registry.length) {
			    	//we've got URLs for all the connected shims, so return
			    	cb(null, auths);
			    }
			  } else {
			  	console.log("error:"+error);
			  	cb(error);
			  }
			}
		}

		if (err) {
			console.log("error:"+err);
			cb(err);
		} else {
			var auths = [];
			for (var i=0; i< registry.length; i++) {
				var shim = registry[i].shimKey;
				var shimName = registry[i].label;
				var shimmerUri = this.host+'/authorize/'+shim+'/'+'?username='+user;
				console.log(shimmerUri);
				request(shimmerUri, processAuth(shim, shimName));
			}
		}
	}.bind(this));
}

// export the class
module.exports = Shimmer;


/**
http://omh-shimmer.datanosh.com:8083/data/jawbone/activity?username=nosh&dateStart=2015-09-09&dateEnd=2015-10-09
**/