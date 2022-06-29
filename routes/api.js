var express = require("express");
var router = express.Router();
var bodyParser = require("body-parser");
var fs = require("fs");
const _ = require("lodash");
const mapfname = "maps.json";
let maps;

////////////////////////////////////////////////////////////////////////////////

function initEmptyMap() {
	maps = {
		map_0_wildcard: [],
		map_1_wildcard: [],
		map_2_wildcard: [],
		map_3_wildcard: [],
		map_4_wildcard: [],
	};
}

try {
	let d = fs.readFileSync(mapfname, "utf8");
	let o = JSON.parse(d);
	if (_.isObject(o)) {
		if (
			_.isArray(o.map_0_wildcard) &&
			_.isArray(o.map_1_wildcard) &&
			_.isArray(o.map_2_wildcard) &&
			_.isArray(o.map_3_wildcard) &&
			_.isArray(o.map_4_wildcard)
		) {
			console.log(`Loaded map data from ${mapfname}`);
			maps = o;
		} else {
			console.log(`Could not find map data in ${mapfname} - setting to empty (please use /api/postcsv to set data)`);
			initEmptyMap();
		}
	} else {
		console.log(`Could not find map data in ${mapfname} - setting to empty (please use /api/postcsv to set data)`);
		initEmptyMap();
	}
} catch (err) {
	console.error(err.message);
	console.log(`Could not find map data in ${mapfname} - setting to empty (please use /api/postcsv to set data)`);
	initEmptyMap();
}

////////////////////////////////////////////////////////////////////////////////
// READ CSV
function readCsv(data) {
	try {
		data = data.replaceAll("\r", "");
		data = _.trim(data);
		let lines = _.split(data, "\n");
		lines = _.drop(lines);
		for (let i = 0; i < lines.length; i++) {
			let o = processLine(_.split(lines[i], ","));
			if (o.wildcardCount == 0) maps.map_0_wildcard.push(o);
			else if (o.wildcardCount == 1) maps.map_1_wildcard.push(o);
			else if (o.wildcardCount == 2) maps.map_2_wildcard.push(o);
			else if (o.wildcardCount == 3) maps.map_3_wildcard.push(o);
			else if (o.wildcardCount == 4) maps.map_4_wildcard.push(o);
		}
		fs.writeFileSync(mapfname, JSON.stringify(maps, null, 3));
		console.log(`Written map data to ${mapfname}`);
	} catch (e) {
		throw e;
	}
}

////////////////////////////////////////////////////////////////////////////////
function processLine(argList) {
	if (!_.isArray(argList) || argList.length != 5) throw `argument list is not an array or length 5: ${JSON.stringify(argList)}`;

	let ret = {wildcardCount: 0};
	//////////////////////////////////////////////////////////////////////////////
	if (argList[0] == "*" || parseInt(argList[0] == NaN)) {
		ret.wildcardCount++;
		ret.rightsGroup = null;
	} else {
		ret.rightsGroup = parseInt(argList[0]);
	}
	//////////////////////////////////////////////////////////////////////////////
	if (argList[1] == "*") {
		ret.wildcardCount++;
		ret.countries = null;
	} else {
		ret.countries = _.split(_.trim(argList[1]), " ");
		for (let i = 0; i < ret.countries.length; i++) ret.countries[i] = ret.countries[i].toLowerCase();
	}
	//////////////////////////////////////////////////////////////////////////////
	if (argList[2] == "*" || parseInt(argList[2] == NaN)) {
		ret.wildcardCount++;
		ret.application = null;
	} else {
		ret.application = _.parseInt(argList[2]);
	}
	//////////////////////////////////////////////////////////////////////////////
	if (argList[3] == "*") {
		ret.wildcardCount++;
		ret.languages = null;
	} else {
		ret.languages = _.split(_.trim(argList[3]), " ");
		for (let i = 0; i < ret.languages.length; i++) ret.languages[i] = ret.languages[i].toLowerCase();
	}
	//////////////////////////////////////////////////////////////////////////////
	if (argList[4] == "*" || parseInt(argList[4] == NaN)) {
		throw "No valid prop page identifier provided";
	} else {
		ret.groupId = _.parseInt(argList[4]);
	}
	////////////////////////////////////////////////////////////////////////////////
	return ret;
}

////////////////////////////////////////////////////////////////////////////////
function matchClientToSubGroup(clientRequest, map) {
	for (let i = 0; i < map.length; i++) {
		let match = true;
		if (match && map[i].rightsGroup != null && clientRequest.rightsGroup != map[i].rightsGroup) match = false;
		if (match && map[i].countries != null && !map[i].countries.includes(clientRequest.country.toLowerCase())) match = false;
		if (match && map[i].application != null && clientRequest.application != map[i].application) match = false;
		if (match && map[i].languages != null && !map[i].languages.includes(clientRequest.language.toLowerCase())) match = false;
		if (match) return map[i];
	}
	return null;
}

////////////////////////////////////////////////////////////////////////////////
function matchClientToGroup(clientRequest) {
	let matchGrp = matchClientToSubGroup(clientRequest, maps.map_0_wildcard);
	if (matchGrp == null) matchGrp = matchClientToSubGroup(clientRequest, maps.map_1_wildcard);
	if (matchGrp == null) matchGrp = matchClientToSubGroup(clientRequest, maps.map_2_wildcard);
	if (matchGrp == null) matchGrp = matchClientToSubGroup(clientRequest, maps.map_3_wildcard);
	if (matchGrp == null) matchGrp = matchClientToSubGroup(clientRequest, maps.map_4_wildcard);
	return matchGrp;
}

////////////////////////////////////////////////////////////////////////////////
router.post("/postcsv", function (req, res, next) {
	try {
		readCsv(req.body);
		res.status(200).json(maps);
	} catch (e) {
		res.status(400).json(e);
	}
});

////////////////////////////////////////////////////////////////////////////////
router.get("/map", function (req, res, next) {
	console.log(maps);
	res.status(200).json(maps);
});

////////////////////////////////////////////////////////////////////////////////
router.get("/group", function (req, res, next) {
	let cr = {
		rightsGroup:
			req.get("x-mpss-rg") != undefined
				? req.get("x-mpss-rg")
				: _.get(req.query, "rightsGroup", undefined) != undefined
				? _.get(req.query, "rightsGroup")
				: res.status(400).json({error: "No rights group defined"}),
		application:
			req.get("x-mpss-app") != undefined
				? req.get("x-mpss-app")
				: _.get(req.query, "application", undefined) != undefined
				? _.get(req.query, "application")
				: res.status(400).json({error: "No application defined"}),
		country:
			req.get("x-mpss-country") != undefined
				? req.get("x-mpss-country")
				: _.get(req.query, "country", undefined) != undefined
				? _.get(req.query, "country")
				: res.status(400).json({error: "No country defined"}),
		language:
			req.get("x-mpss-lang") != undefined
				? req.get("x-mpss-lang")
				: _.get(req.query, "language", undefined) != undefined
				? _.get(req.query, "language")
				: res.status(400).json({error: "No language defined"}),
	};

	let val = matchClientToGroup(cr);

	if (val != null) {
		const {wildcardCount, ...rest} = val;
		res.status(200).json({group: val.groupId, request: cr, match: rest});
	} else {
		res.status(404).json({error: `No group found for user`, request: cr});
	}
});

module.exports = {
	router,
};
