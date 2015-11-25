'use strict';

var chai = require('chai');

chai.config.includeStack = true;

global.expect = chai.expect;
global.AssertionError = chai.AssertionError;
global.Assertion = chai.Assertion;
global.assert = chai.assert;

describe('Mussel Transform Objects', function () {
	var mussel;
	before(function () {
       	var Mussel = require("../index.js");
        mussel = new Mussel({}, {});
    });


	it('should return empty array when sent no physical activity data', function (done) {
        var result = mussel.transformActivitiesToTidepoolActivities({body:[]}, function(err, result) {
        	expect(result).to.be.empty;
        	done();
        });
        
    });

	    it('should correctly return transformed objects', function (done) {
	        var result = mussel.transformActivitiesToTidepoolActivities(sampleData, function(err, result) {
	    	
	    	//uploadId changes every time so just delete it to not screw up tests
	    	delete result[0].uploadId;
	    	delete result[1].uploadId;

	    	expect(result).to.eql(correctResult);
	    	done();
        });
        
    });


});

var sampleData = {
  "shim": "runkeeper",
  "timeStamp": 1448399228,
  "body": [
    {
      "header": {
        "id": "af333ccf-a5a3-4337-9505-fac60ad824f2",
        "creation_date_time": "2015-11-24T21:07:08.430Z",
        "acquisition_provenance": {
          "source_name": "Runkeeper HealthGraph API",
          "modality": "sensed",
          "external_id": "/fitnessActivities/682442439"
        },
        "schema_id": {
          "namespace": "omh",
          "name": "physical-activity",
          "version": "1.0"
        }
      },
      "body": {
        "effective_time_frame": {
          "time_interval": {
            "start_date_time": "2015-10-27T23:49:00-04:00",
            "duration": {
              "unit": "sec",
              "value": 124.299
            }
          }
        },
        "activity_name": "Running",
        "distance": {
          "unit": "m",
          "value": 85.1766013840552
        }
      }
    },
    {
      "header": {
        "id": "c2e03964-fb2f-426e-87eb-0f9ae1ba0940",
        "creation_date_time": "2015-11-24T21:07:08.430Z",
        "acquisition_provenance": {
          "source_name": "Runkeeper HealthGraph API",
          "modality": "sensed",
          "external_id": "/fitnessActivities/679963655"
        },
        "schema_id": {
          "namespace": "omh",
          "name": "physical-activity",
          "version": "1.0"
        }
      },
      "body": {
        "effective_time_frame": {
          "time_interval": {
            "start_date_time": "2015-10-23T18:16:50-04:00",
            "duration": {
              "unit": "sec",
              "value": 148.311
            }
          }
        },
        "activity_name": "Running",
        "distance": {
          "unit": "m",
          "value": 10.3929068646607
        }
      }
    }
  ]
};

var correctResult = [{"type":"physicalActivity","subType":"runkeeper","time":"2015-10-28T03:49:00.000Z","timezoneOffset":-240,"conversionOffset":0,"deviceId":"runkeeper","datapoint":{"header":{"id":"af333ccf-a5a3-4337-9505-fac60ad824f2","creation_date_time":"2015-11-24T21:07:08.430Z","acquisition_provenance":{"source_name":"Runkeeper HealthGraph API","modality":"sensed","external_id":"/fitnessActivities/682442439"}},"body":{"effective_time_frame":{"time_interval":{"start_date_time":"2015-10-27T23:49:00-04:00","duration":{"unit":"sec","value":124.299}}},"activity_name":"Running","distance":{"unit":"m","value":85.1766013840552}}}},{"type":"physicalActivity","subType":"runkeeper","time":"2015-10-23T22:16:50.000Z","timezoneOffset":-240,"conversionOffset":0,"deviceId":"runkeeper","datapoint":{"header":{"id":"c2e03964-fb2f-426e-87eb-0f9ae1ba0940","creation_date_time":"2015-11-24T21:07:08.430Z","acquisition_provenance":{"source_name":"Runkeeper HealthGraph API","modality":"sensed","external_id":"/fitnessActivities/679963655"}},"body":{"effective_time_frame":{"time_interval":{"start_date_time":"2015-10-23T18:16:50-04:00","duration":{"unit":"sec","value":148.311}}},"activity_name":"Running","distance":{"unit":"m","value":10.3929068646607}}}}];


