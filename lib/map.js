/**
 *
 * Code inspired by:
 * - http://prag.ma/code/d3-cartogram/
 * - http://techslides.com/demos/d3/worldmap-template.html
 *

 */

// hide the form if the browser doesn't do SVG,
// (then just let everything else fail)
if (!document.createElementNS) {
  document.getElementsByTagName("form")[0].style.display = "none";
}

// Define the colors with colorbrewer
var colors = colorbrewer.Blues[9];
      //.reverse();
      //.map(function(rgb) { return d3.hsl(rgb); });

// Set the (initial) width and height of the map
var width = 960,
    height = 600;

// Define the elements needed for map creation
var body = d3.select("body"),
    stat = d3.select("#status"),
    map = d3.select("#map").attr("preserveAspectRatio", "xMidYMid")
      .attr("viewBox", "0 0 " + width + " " + height),
    layer = map.append("g")
      .attr("id", "layer"),
    mapFeatures = layer.append("g")
      .attr("id", "mapFeatures")
      .selectAll("path"),
    tooltip = d3.select("#map-container")
      .append("div")
      .attr("class", "ttip hidden");

// Define the zoom and attach it to the map
var zoom = d3.behavior.zoom()
      .scaleExtent([1, 10])
      .on('zoom', doZoom);
map.call(zoom);

// Define the projection of the map (center and scale will be defined
// later)
var proj = d3.geo.mercator();

// Prepare the cartogram
var topology,
    geometries,
    dataById = {},
	population = {},
    carto = d3.cartogram()
      .projection(proj)
      .properties(function(d) {
        if (!dataById[d.properties.code+"_"+sexe.id+"_"+date]) {
          console.log('ERROR: Entry "' + d.properties.code + '" was found in the Topojson but not in the data CSV. Please correct either of them.');
        }
        // Add the cartogram data as property of the cartogram features
        return dataById[d.properties.code+"_"+sexe.id+"_"+date];
      });
// Define the type of the map	
var types =  [
      {name: "No Scale", id: "none"},
      {name: "Cartogram", id: "cartogram"},
    ],
	typeById = d3.nest()
      .key(function(d) { return d.id; })
      .rollup(function(d) { return d[0]; })
      .map(types),
    type = types[0]; 

// Define the fields of the data	
var sexes =  [
      {name: "Ensemble", id: "0"},
      {name: "Homme", id: "1"},
      {name: "Femme", id: "2"},
    ],
	sexesById = d3.nest()
      .key(function(d) { return d.id; })
      .rollup(function(d) { return d[0]; })
      .map(sexes),
    sexe = sexes[0]; 
var fields = [
      {name: "Décès", id: "dc",key: "%t_dc_%s_%d"},
      {name: "Réanimations", id: "rea",key: "%t_rea_%s_%d"},
      {name: "Guérisons", id: "rad",key: "%t_rad_%s_%d"},
      {name: "Hospitalisations", id: "hosp",key: "%t_hosp_%s_%d"}
    ],
	fieldsById = d3.nest()
      .key(function(d) { return d.id; })
      .rollup(function(d) { return d[0]; })
      .map(fields),
    field = fields[0];
	
var date="2020-03-18";
    
    

// Define the dropdown to select a field to scale by.
var fieldSelect = d3.select("#field")
      .on("change", function(e) {
        // On change, update the URL hash
        field = fields[this.selectedIndex];
		updateCurrentKey(field);
		draw();
     });
$('#date').on("change", function(e) {
        // On change, update the URL hash
        var d = new Date($('#date').val());
		var day = d.getDate();
		var month = d.getMonth() + 1;
		var year = d.getFullYear();
		
		var formattedDay = ("0" + day).slice(-2);
		var formattedMonth = ("0" + month).slice(-2);		
		date = [year, formattedMonth, formattedDay].join('-');
		field.key.replace("%d", date);
		updateCurrentKey(field);
		draw();
      });
var sexeSelect = d3.select("#sexe")
      .on("change", function(e) {
        // On change, update the URL hash
        sexe = sexes[this.selectedIndex];
		field.key.replace("%s", sexe);
		updateCurrentKey(field);
		draw();
      });
var typeSelect = d3.select("#type")
      .on("change", function(e) {
        // On change, update the URL hash
        type = types[this.selectedIndex];
 		field.key.replace("%t", type);
		updateCurrentKey(field);
		draw();
      });
var currentKey = field.key.replace("%d", date);
  currentKey = currentKey.replace("%s", sexe.id);
  currentKey = currentKey.replace("%t", type.id);

// Read the geometry data
d3.json('./data/departements.topojson', function(topo) {
  topology = topo;

  // The mapped unit for regions: Régions
  geometries = topology.objects.collection.geometries;
  d3.csv("./data/population.csv", function(data1) {
	 population = d3.nest()
      .key(function(d) { return d.departements; })
      .rollup(function(d) { return d[0]; })
      .map(data1);
  });

  // Read the data for the cartogram
  d3.csv("./data/covid_hospit.csv", function(data) {
	
    // Prepare a function to easily access the data by its ID
    // "ID" for régions: nom
    dataById = d3.nest()
      .key(function(d) { 
		return d.dep+"_"+d.sexe+"_"+d.jour; 
	  })
      .rollup(function(d) { return d[0]; })
      .map(data);

    // Initialize the map
    init();
  });
});


/**
 * Initialize the map. Creates the basic map without scaling of the
 * features.
 */
function init() {

  // Create the cartogram features (without any scaling)
  var cartoFeatures = carto.features(topology, geometries),
      path = d3.geo.path()
        .projection(proj);

  // Determine extent of the topology
  var b = topology.bbox;
  t = [(b[0]+b[2])/2, (b[1]+b[3])/2];
  s = 0.95 / Math.max(
      (b[2] - b[0]) / width,
      (b[3] - b[1]) / height
    );

  // Scale it to fit nicely
  s = s * 40;
  proj
      .scale(s)
      .center(t).translate([width / 2, height / 2]);

  // Put the features on the map
  mapFeatures = mapFeatures.data(cartoFeatures)
    .enter()
    .append("path")
      .attr("class", "mapFeature")
      .attr("id", function(d) {
        return getName(d);
      })
      .attr("fill", "#ddd")
      .attr("d", path);

  // Show tooltips when hovering over the features
  // Use "mousemove" instead of "mouseover" to update the tooltip
  // position when moving the cursor inside the feature.
  mapFeatures.on('mousemove', showTooltip)
    .on('mouseout', hideTooltip);

  // Parse the URL hash to see if the map was loaded with a cartogram
  //parseHash();
  draw();
}


/**
 * Reset the cartogram and show the features without scaling.
 */
function reset() {

  // Reset the calculation statistics text
  stat.text("");

  // Create the cartogram features (without any scaling)
  var cartoFeatures = carto.features(topology, geometries),
      path = d3.geo.path()
        .projection(proj);
		
	 // Prepare the values and determine minimum and maximum values
	  var value = function(d) {
		return getValue(d);
	  },
      values = mapFeatures.data()
        .map(value)
        .filter(function(n) {
          return !isNaN(n);
        })
        .sort(d3.ascending),
      lo = values[0],
      hi = values[values.length - 1];

  // Determine the colors within the range
  var color = d3.scale.linear()
    .range(colors)
    .domain(lo < 0
      ? [lo, 0, hi]
      : [lo, d3.median(values), hi]);
  var myColor = d3.scale.linear().domain([lo, hi])
  .range(["lightsteelblue", "darkblue"])

  // Redraw the features with a transition
  mapFeatures.data(cartoFeatures)
    .transition()
      .duration(750)
      .ease("linear")
      .attr("fill", function(d) {
      return myColor(value(d));
    })
      .attr("d", path);
}


/**
 * Update the cartogram to scale the features.
 */
function update() {

  // Keep track of the time it takes to calculate the cartogram
  var start = Date.now();
  
  // Update the current key

  currentKey = field.key.replace("%d", date);
  currentKey = currentKey.replace("%s", sexe.id);
  currentKey = currentKey.replace("%t", type.id);

  // Prepare the scaled values and determine minimum and maximum values
  var scaledValue = function(d) {
    return getScaledValue(d);
  },
      scaledValues = mapFeatures.data()
        .map(scaledValue)
        .filter(function(n) {
          return !isNaN(n);
        })
        .sort(d3.ascending),
      loScaled = scaledValues[0],
      hiScaled = scaledValues[scaledValues.length - 1];
 // Normalize the scale to positive numbers
  var scale = d3.scale.linear()
    .domain([loScaled, hiScaled])
    .range([1, 1000]);

  // Tell the cartogram to use the scaled values
  carto.value(function(d) {
    return scale(scaledValue(d));
  });

  // Generate the new features and add them to the map
  var cartoFeatures = carto(topology, geometries).features;
  mapFeatures.data(cartoFeatures);

  // Prepare the values and determine minimum and maximum values
  var value = function(d) {
    return getValue(d);
  },
      values = mapFeatures.data()
        .map(value)
        .filter(function(n) {
          return !isNaN(n);
        })
        .sort(d3.ascending),
      lo = values[0],
      hi = values[values.length - 1];

  // Determine the colors within the range
  var color = d3.scale.linear()
    .range(colors)
    .domain(lo < 0
      ? [lo, 0, hi]
      : [lo, d3.median(values), hi]);
  var myColor = d3.scale.linear().domain([lo, hi])
  .range(["lightsteelblue", "darkblue"])
	

  // Scale the cartogram with a transition
  mapFeatures.transition()
    .duration(750)
    .ease("linear")
    .attr("fill", function(d) {
      return myColor(value(d));
    })
    .attr("d", carto.path);

  // Show the calculation statistics and hide the update indicator
  var delta = (Date.now() - start) / 1000;
  stat.text(["calculated in", delta.toFixed(1), "seconds"].join(" "));
  hideUpdateIndicator();
}


/**
 * Use a deferred function to update the cartogram. This allows to set a
 * timeout limit.
 */
var deferredUpdate = (function() {
  var timeout;
  return function() {
    var args = arguments;
    clearTimeout(timeout);
    stat.text("calculating...");
    return timeout = setTimeout(function() {
      update.apply(null, arguments);
    }, 10);
  };
})();
function draw() {
	if(type.id === 'none') {
		reset();
	}else {
		showUpdateIndicator();
		deferredUpdate();
	}
}

/**
 * Show a tooltip with details of a feature, e.g. when hovering over a
 * feature on the map.
 *
 * @param {Feature} d - The feature
 * @param {Number} i - The ID of the feature
 */
function showTooltip(d, i) {

  // Get the current mouse position (as integer)
  var mouse = d3.mouse(map.node()).map(function(d) { return parseInt(d); });

  // Calculate the absolute left and top offsets of the tooltip. If the
  // mouse is close to the right border of the map, show the tooltip on
  // the left.
  var left = Math.min(width-12*getName(d).length, (mouse[0]+20));
  var top = Math.min(height-40, (mouse[1]+20));
  // Populate the tooltip, position it and show it
  tooltip.classed("hidden", false)
    .attr("style", "left:"+left+"px;top:"+top+"px")
    .html([
      '<strong>', getName(d), '</strong><br/>',
      getFormatedValue(d),
    ].join(''));
}


/**
 * Hide the tooltip.
 */
function hideTooltip() {
  tooltip.classed("hidden", true);
}


/**
 * Zoom the features on the map.
 */
function doZoom() {

  // Zoom and keep the stroke width proportional
  mapFeatures.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")").style("stroke-width", .5 / d3.event.scale + "px");

  // Hide the tooltip after zooming
  hideTooltip();
}


/**
 * Show an update indicating while calculating the cartogram.
 */
function showUpdateIndicator() {
  body.classed("updating", true);
}


/*
 * Hide the update indicator after the cartogram was calculated.
 */
function hideUpdateIndicator() {
  body.classed("updating", false);
}

function updateCurrentKey(field) {
	currentKey = field.key.replace("%d", date);
	currentKey = currentKey.replace("%s", sexe.id);
	currentKey = currentKey.replace("%t", type.id);

}
/**
 * Helper function to access the property of the feature used as value scaled with population.
 *
 * @param {Feature} f
 * @return {Number} value
 */
function getScaledValue(f) {
  //Split current key to retrieve field
  var parts = currentKey.split("_"),
	desiredFieldId = parts[1],
	desiredSexeId = parts[2],
	desiredDate = parts[3];
	desiredType = parts[0];
 
  var v =  (f.properties[desiredFieldId]/getTotalPopulation(f))*10000;
  return Number(v.toFixed(2));
}
/**
 * Helper function to access the property of the feature used as value.
 *
 * @param {Feature} f
 * @return {Number} value
 */
function getValue(f) {
  //Split current key to retrieve field
  var parts = currentKey.split("_"),
	desiredFieldId = parts[1],
	desiredSexeId = parts[2],
	desiredDate = parts[3];
	desiredType = parts[0];	
 
  var v =  f.properties[desiredFieldId];
  return Number(v);
}
/**
 * Helper function to access the property of the feature used as value.
 *
 * @param {Feature} f
 * @return {String} value
 */
function getFormatedValue(f) {
  //Split current key to retrieve field
  var parts = currentKey.split("_"),
	desiredFieldId = parts[1],
	desiredSexeId = parts[2],
	desiredDate = parts[3];
	desiredType = parts[0];
	var labelField = fieldsById[desiredFieldId].name;
	var labelSexe = sexesById[desiredSexeId].name;
	
	var v =  labelField + ":" + f.properties[desiredFieldId]+"</br>";
	v =  v + labelField + "(pour 10 000 habitants) :" + getScaledValue(f)+"</br>";
	v = v + "Sexe : "+labelSexe +"</br>";
	v = v + "Date : "+desiredDate +"</br>";
	return v;
}

/**
 * Helper function to access the property of the feature used as name or
 * label.
 *
 * @param {Feature} f
 * @return {String} name
 */
function getName(f) {
  return population[f.properties.dep].nom;
}

function getTotalPopulation(f) {
	var total = population[f.properties.dep].total
	return total;	
}


/**
 * Format a number: Add thousands separator.
 * http://stackoverflow.com/a/2901298/841644
 */
function formatNumber(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}
