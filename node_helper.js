'use strict';

/* Magic Mirror
 * Module: "MMM-VigilancePollensFrance
 *
 * Magic Mirror By Michael Teeuw https://magicmirror.builders
 * MIT Licensed.
 *
 * Module "MMM-VigilancePollensFrance By Grena https://github.com/grenagit
 * MIT Licensed.
 */

const NodeHelper = require('node_helper');
const fetch = require('node-fetch');

module.exports = NodeHelper.create({

	getData: function() {
		var self = this;

		fetch(self.config.apiBase + self.config.pollensEndpoint + self.config.department, { method: 'GET' })
		.then(function(response) {
			if (response.status === 200) {
				return response.json();
			} else {
				self.sendSocketNotification("ERROR", response.status);
			}
		})
		.then(function(result) {
			self.sendSocketNotification("DATA", result);
		})
	},

	socketNotificationReceived: function(notification, payload) {
		var self = this;
		if (notification === 'CONFIG') {
			self.config = payload;
			self.sendSocketNotification("STARTED", true);
			self.getData();
		}
	}

});

