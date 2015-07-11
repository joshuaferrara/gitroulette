var express = require('express');
var app = express();
var path = require('path');
var request = require('request');
require('datejs');

if (process.env.HEROKU) {
	var config = {};
	config.clientid = process.env.CLIENTID;
	config.clientsecret = process.env.CLIENTSECRET;
	config.useragent = process.env.USERAGENT;
} else {
	var config = require('./config');
}


app.set('views', path.join(__dirname, 'views'));  
app.set('view engine', 'jade');

// Generate a random integer: low < retVal < high
function randomInt (low, high) {
    return Math.floor(Math.random() * (high - low) + low);
}

// This function will make a request to the github API, then call a callback function with the data as an argument.
function getRandomRepo(callback) {
	var randStart = randomInt(0, 10000000);
	var reqOpts = {
		url: 'https://api.github.com/repositories?client_id=' + config.clientid + '&client_secret=' + config.clientsecret + '&since=' + randStart,
		headers: {
			'User-Agent': config.useragent
		}
	};
	request(reqOpts, function(err, resp, body) {
		try {
			var gitData = JSON.parse(body);

			if (gitData.message !== undefined && gitData.message.indexOf('API rate limit exceeded') !== -1) {
				callback({
					rateLimited: true
				});
			} else {
				var randRepo = gitData[randomInt(0, gitData.length)];
				var oReqOpts = {
					url: randRepo.url + '?client_id=' + config.clientid + '&client_secret=' + config.clientsecret,
					headers: {
						'User-Agent': config.useragent
					}
				};
				request(oReqOpts, function(err, resp, body) {
					try {
						var repoData = JSON.parse(body);
						callback({
							repoData: repoData,
							owner: repoData.owner,
						});						
					} catch(err2) {
						console.error('Error parsing github API data. ERR 2');
						console.error(body);
						throw(err2);
					}
				});
			}
		} catch (err) {
			console.error('Error parsing github API data. ERR 1');
			console.error(body);
			throw(err);
		}
	});
}

function rateLimit(callback) {
	var reqOpts = {
		url: 'https://api.github.com/rate_limit?client_id=' + config.clientid + '&client_secret=' + config.clientsecret,
		headers: {
			'User-Agent': config.useragent
		}
	};
	request(reqOpts, function(err, resp, body) {
		callback(JSON.parse(body));
	});
}

function unix() {
	return Math.floor(Date.now() / 1000);
}

// This route will display the home page providing an interface to get a random repository.
app.get('/', function (req, res) {
	getRandomRepo(function(data) {
		rateLimit(function(rateData) {
			var outData = data;
			outData.rateLimit = rateData;
			outData.moreResourcesIn = (new Date()).clearTime().addSeconds(rateData.resources.core.reset - unix()).toString('mm:ss');
			res.render('index', outData);
		});
	});
});

// This is going to return a random git repository as well as some metadata encoded in JSON.
app.get('/random', function(req, res) {
	getRandomRepo(function(data) {
		rateLimit(function(rateData) {
			var outData = data;
			outData.rateLimit = rateData;
			outData.moreResourcesIn = (new Date()).clearTime().addSeconds(rateData.resources.core.reset - unix()).toString('mm:ss');
			res.send(outData);
		});
	});
});

app.get('/rate-limit', function(req, res) {
	rateLimit(function(data) {
		res.send(data);
	});
});

var server = app.listen(process.env.PORT || 3000, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('GitRoulette listening at http://%s:%s', host, port);
});