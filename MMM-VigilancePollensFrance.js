/* Magic Mirror
 * Module: MMM-VigilancePollensFrance
 *
 * Magic Mirror By Michael Teeuw https://magicmirror.builders
 * MIT Licensed.
 *
 * Module MMM-VigilancePollensFrance By Grena https://github.com/grenagit
 * MIT Licensed.
 */

Module.register("MMM-VigilancePollensFrance", {

	// Default module config
	defaults: {
		department: 0,
		updateInterval: 1 * 60 * 60 * 1000, // every 1 hour
		animationSpeed: 1000, // 1 second
		notificationDuration: 1 * 60 * 1000, // 1 minute
		maxPollensInline: 3,
		minPollensLevel: 1,
		showDepartment: false,
		showNotification: true,
		useColorLegend: true,

		initialLoadDelay: 0, // 0 seconds delay

		apiBase: "https://www.pollens.fr/",
		pollensEndpoint: "risks/thea/counties/"
	},

	// Define required scripts
	getStyles: function() {
		return ["MMM-VigilancePollensFrance.css", "font-awesome.css"];
	},

	// Define start sequence
	start: function() {
		Log.info("Starting module: " + this.name);

		this.departmentName = null;
		this.departmentNumber = null;
		this.pollenLevel = null;
		this.pollenTitle = null;
		this.pollenRisks = [];

		this.lastData = {};

		this.loaded = false;

		this.scheduleUpdate(this.config.initialLoadDelay);
	},

	// Override dom generator
	getDom: function() {
		var wrapper = document.createElement("div");

		if(!this.config.department) {
			wrapper.innerHTML = "Please set the vigilance <i>department</i> in the config for module: " + this.name + ".";
			wrapper.className = "dimmed light small";
			return wrapper;
		}

		if(!this.loaded) {
			wrapper.innerHTML = this.translate("LOADING");
			wrapper.className = "dimmed light small";
			return wrapper;
		}
		
		if(this.config.showDepartment) {
			var department = document.createElement('div');
			department.className = "dimmed light small department";

			department.innerHTML = this.departmentName + " (" + this.departmentNumber + ")";

			wrapper.appendChild(department);
		}

		var medium = document.createElement("div");
		medium.className = "normal medium title";

		var vigiIcon = document.createElement('span');

		vigiIcon.className = "fas fa-exclamation-circle dimmed";
		if(this.config.useColorLegend) {
			vigiIcon.style = "color: " + this.level2color(this.pollenLevel) + ";";
		}
		medium.appendChild(vigiIcon);

		var spacer = document.createElement("span");
		spacer.innerHTML = "&nbsp;";
		medium.appendChild(spacer);

		var vigiText = document.createElement("span");
		vigiText.innerHTML = " " + this.pollenTitle;
		medium.appendChild(vigiText);

		wrapper.appendChild(medium);

		var risks = document.createElement("div");
		risks.className = "normal small risks";

		for(let i = 0; i < this.pollenRisks.length; i++) {
			if(i > 0) {
				if(i % this.config.maxPollensInline == 0) {
					var breakline = document.createElement("br");
					risks.appendChild(breakline);
				} else {
					var spacer = document.createElement("span");
					spacer.innerHTML = "&nbsp;&nbsp;&nbsp;";
					risks.appendChild(spacer);
				}
			}

			var risksIcon = document.createElement('span');
			risksIcon.className = "fab fa-pagelines";
			if(this.config.useColorLegend) {
				risksIcon.style = "color: " + this.level2color(this.pollenRisks[i].level) + ";";
			}
			risks.appendChild(risksIcon);

			var risksText = document.createElement("span");
			risksText.className = "dimmed light";
			risksText.innerHTML = "&nbsp;" + this.pollenRisks[i].pollenName;
			risks.appendChild(risksText);
		}

		wrapper.appendChild(risks);

		return wrapper;
	},
	
	// Request new data from pollens.fr with node_helper
	socketNotificationReceived: function(notification, payload) {
		if(notification === "STARTED") {
			this.updateDom(this.config.animationSpeed);
		} else if(notification === "ERROR") {
			Log.error(this.name + ": Do not access to data (" + payload + " HTTP error).");
		} else if(notification === "DATA") {
			this.processVigi(payload);
		}
	},
	
	// Change the vigilance department upon receipt of notification
	notificationReceived: function(notification, payload) {
		if(notification === "VIGI_POLLENSFRANCE_DEPARTMENT" && payload != this.config.department) {
			this.config.department = payload;
			this.lastData = {};

			this.loaded = false;

			this.sendSocketNotification('CONFIG', this.config);
		}
	},

	// Use the received data to set the various values before update DOM
	processVigi: function(data) {
		if(!data || data.countyNumber != this.config.department || !data.riskLevel || typeof data.risks === "undefined") {
			Log.error(this.name + ": Do not receive usable data.");
			return;
		}
		
		if(this.config.hideGreenLevel) {
			if(data.level == 0) {
				this.hide();
			} else {
				this.show();
			}
		}
		
		this.departmentName = data.countyName;
		this.departmentNumber = data.countyNumber;

		this.pollenLevel = data.riskLevel;
		
		switch(data.riskLevel) {
			case 0:
				this.pollenTitle = "Pas de risque";
				break;
			case 1:
				this.pollenTitle = "Risque très faible";
				break;
			case 2:
				this.pollenTitle = "Risque faible";
				break;
			case 3:
				this.pollenTitle = "Risque moyen";
				break;
			case 4:
				this.pollenTitle = "Risque élevé";
				break;
			case 5:
				this.pollenTitle = "Risque très élevé";
				break;
		}
		
		this.pollenRisks = data.risks.filter(pollen => this.selectMinLevel(pollen)).sort((pollenA, pollenB) => this.sortPollens(pollenA, pollenB));
		
		if(this.config.showNotification) {
			if(!this.loaded && data.level >= 2) {
				this.notifyVigi("Attention, votre <strong>département</strong> est placé en <strong>vigilance " + this.pollenColor + "</strong> !");
			}
			if(this.loaded && data.level > this.lastData.level) {
				this.notifyVigi("Attention, le <strong>niveau de vigilance</strong> augmente dans <strong>votre département</strong> !");
			}
			if(this.loaded && data.level < this.lastData.level) {
				this.notifyVigi("Bonne nouvelle, le <strong>niveau de vigilance</strong> diminue dans <strong>votre département</strong> !");
			}
		}
		
		if(this.loaded && this.config.showNotification) {
			var self = this;
			let newRisks = data.risks.filter(function(obj1) {
    		return !self.lastData.risks.some(function(obj2) {
        	return obj1.id == obj2.id;
    		});
			});
			if(newRisks.length == 1) {
				this.notifyVigi("Attention, un <strong>nouveau risque</strong> vient d'être <strong>signalé</strong> dans <strong>votre département</strong> !");
			} else if(newRisks.length > 1) {
				this.notifyVigi("Attention, de <strong>nouveaux risques</strong> viennent d'être <strong>signalés</strong> dans <strong>votre département</strong> !");
			}
		}

		this.loaded = true;
		this.lastData = data;
		this.updateDom(this.config.animationSpeed);
		this.scheduleUpdate();
	},

	// Schedule next update
	scheduleUpdate: function(delay) {
		var nextLoad = this.config.updateInterval;
		if(typeof delay !== "undefined" && delay >= 0) {
			nextLoad = delay;
		}

		var self = this;
		setTimeout(function() {
			self.sendSocketNotification('CONFIG', self.config);
		}, nextLoad);
	},

	// Convert risk's level to color
	level2color: function(level) {
		switch(level) {
			case 0:
				return "#ffffff";
				break;
			case 1:
				return "#377d22";
				break;
			case 2:
				return "#ef8641";
				break;
			case 3:
				return "#75f94c";
				break;
			case 4:
				return "#fffd54";
				break;
			case 5:
				return "#ea3522";
				break;	
		}
	},

	// Send notification 
	notifyVigi: function(text) {
		this.sendNotification("SHOW_ALERT", {
			type: "notification",
			title: "Vigilance Pollens France",
			message: text,
			timer: this.config.notificationDuration
		});
	},
	
	// Filter to select minimum level of pollen allergy risk
	selectMinLevel: function(pollen) {
		return pollen.level >= this.config.minPollensLevel;
	},
	
	// Comparator to compare two risks by level in ascending order and alphabetically in ascending order
	sortPollens: function(pollenA, pollenB) {
		if(pollenA.level == pollenB.level) return pollenA.pollenName.toLowerCase().localeCompare(pollenB.pollenName.toLowerCase());
		return pollenB.level - pollenA.level;
	}

});
