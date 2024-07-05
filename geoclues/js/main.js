// Global variables
var map; // Leaflet map object
var everything; // Turf.js polygon representing the entire world
var contextMarker; // Marker for right-click / long-click context menu
let region_fuse; // Fuse.js object for fuzzy searching regions
let polygon_inventory; // Object containing region polygons
let clueTemplate; // Template string for clue list, will be parsed from index.html
var participants;

// Map drawings
var drawnItems = L.featureGroup()

// Array to store clues
var clues = JSON.parse(localStorage.getItem('clues')) || [];
// Object to store clue polygons
var clue_polygons = {}
// Maps path to json
var polygon_json = {}

// To ensure compatibility of imported files
FILE_VERSION = "1.0"

// To generate random names for the drawings
const wordlist = ['Apple', 'Beach', 'Cloud', 'Dog', 'Eagle', 'Fire', 'Grass', 'Horse', 'Island', 'Jazz', 'Kite', 'Lemon', 'Moon', 'Nest', 'Ocean', 'Piano', 'Quilt', 'River', 'Sun', 'Tree', 'Umbrella', 'Violin', 'Whale', 'Xylophone', 'Yoga', 'Zebra', 'Air', 'Book', 'Candle', 'Desk', 'Elephant', 'Frog', 'Garden', 'Hat', 'Ice', 'Jacket', 'Key', 'Lamp', 'Mountain', 'Notebook', 'Orange', 'Pencil', 'Queen', 'Rain', 'Shoe', 'Table', 'Unicorn', 'Vase', 'Window', 'Box', 'Cat', 'Door', 'Egg', 'Flower', 'Globe', 'House', 'Igloo', 'Jar', 'King', 'Leaf', 'Mirror', 'Nail', 'Owl', 'Pillow', 'Quartz', 'Robot', 'Star', 'Tiger', 'Van', 'Water', 'Year', 'Zipper', 'Arrow', 'Balloon', 'Camera', 'Diamond', 'Earth', 'Feather', 'Guitar', 'Hammer', 'Ink', 'Jelly', 'Kangaroo', 'Lion', 'Magnet', 'Needle', 'Oasis', 'Paint', 'Quiet', 'Radio', 'Snake', 'Torch', 'Uniform', 'Volcano', 'Wagon', 'Yarn', 'Zest', 'Acorn', 'Bridge', 'Cactus']



// Cahces pending promises, as not to load the same file multiple times
const promiseCache = new Map();

/**
 * Asynchronously loads JSON data from a file.
 * @param {string} filename - The name of the JSON file to load.
 * @returns {Promise<Object>} A promise that resolves with the parsed JSON data.
 */
async function load_json(filename) {
    if (!promiseCache.has(filename)) {
        const promise = fetch(filename)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            });

        promiseCache.set(filename, promise);
    }

    return promiseCache.get(filename);
}

function showNotification(message, error = false) {
    const notificationBar = document.getElementById('notification-bar');
    notificationBar.textContent = message;

    if (error) {
        notificationBar.classList.add('error');
    } else {
        notificationBar.classList.remove('error');
    }

    notificationBar.classList.add('show');

    setTimeout(() => {
        notificationBar.classList.remove('show');
    }, 3000);
}

// Load region data and initialize Fuse.js for region search
load_json('config/inventory.json')
    .then(data => {
        polygon_inventory = data;
        const options = {
            keys: ['name'], // Search for name field in each object
            includeScore: true,
            threshold: 0.3
        };
        // Combine all region types into a single array for searching
        const combinedData = [
            ...Object.entries(polygon_inventory.cantons).map(([name, filename]) => ({ "name": `Kanton ${name}`, "filename": filename })),
            ...Object.entries(polygon_inventory.countries).map(([name, filename]) => ({ "name": `Land ${name}`, "filename": filename })),
            ...Object.entries(polygon_inventory.bezirke).map(([name, filename]) => ({ "name": `Bezirk ${name}`, "filename": filename })),
            ...Object.entries(polygon_inventory.gemeinden).map(([name, filename]) => ({ "name": `Gemeinde ${name}`, "filename": filename })),
            ...Object.entries(polygon_inventory.altitude).map(([name, filename]) => ({ "name": `Altitude above ${name}`, "filename": filename }))
        ];
        region_fuse = new Fuse(combinedData, options);
    })

/**
 * Fallback function to copy text to clipboard for browsers that don't support the Clipboard API.
 * @param {string} text - The text to be copied to the clipboard.
 */
function fallbackCopyTextToClipboard(text) {
    var textArea = document.createElement("textarea");
    textArea.value = text;

    // Avoid scrolling to bottom
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        var successful = document.execCommand('copy');
        var msg = successful ? 'successful' : 'unsuccessful';
        console.log('Fallback: Copying text command was ' + msg);
        if (successful) {
            showNotification(`'${text}' copied to clipboard`)
        }
    } catch (err) {
        console.error('Fallback: Oops, unable to copy', err);
    }

    document.body.removeChild(textArea);
}

/**
 * Copies text to clipboard using the Clipboard API if available, otherwise falls back to execCommand.
 * @param {string} text - The text to be copied to the clipboard.
 */
function copyTextToClipboard(text) {
    if (!navigator.clipboard) {
        fallbackCopyTextToClipboard(text);
        return;
    }
    navigator.clipboard.writeText(text).then(function () {
        console.log('Async: Copying to clipboard was successful!');
        showNotification(`'${text}' copied to clipboard`)
    }, function (err) {
        console.error('Async: Could not copy text: ', err);
    });
}

/**
 * Initializes the Leaflet map and sets up various map layers and controls.
 */
function initMap() {
    map = L.map('map', { attributionControl: false, zoomControl: false });

    // Get map center and zoom from localStorage
    var center = JSON.parse(localStorage.getItem('mapCenter'));
    var zoom = JSON.parse(localStorage.getItem('mapZoom'));

    // Check if center and zoom are available in localStorage
    if (center && zoom) {
        map.setView(center, zoom);
    } else {
        // Defaults if not available in localStorage
        var defaultCenter = [47, 8];
        var defaultZoom = 8;
        map.setView(defaultCenter, defaultZoom);
    }

    // Add context menu on right-click
    map.on('contextmenu', (e) => {
        if (contextMarker) {
            contextMarker.remove();
        }
        const lat = parseFloat(e.latlng.lat.toFixed(5));
        const lng = parseFloat(e.latlng.lng.toFixed(5));
        const position = `${lng}, ${lat}`
        contextMarker = L.marker([lat, lng]).addTo(map);
        contextMarker.bindPopup(`<a onclick="copyTextToClipboard('${position}')">${position}</a>`).openPopup();
    });

    // Update localStorage when map is moved
    map.on('moveend', function () {
        var center = map.getCenter();
        var zoom = map.getZoom();
        localStorage.setItem('mapCenter', JSON.stringify(center));
        localStorage.setItem('mapZoom', JSON.stringify(zoom));
    });

    // Define various map layers
    var streets_layer = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    })
    var satellite_layer = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    })
    var swissTopoLayer = L.tileLayer.wms("https://wms.geo.admin.ch/?", {
        layers: 'ch.swisstopo.pixelkarte-farbe',
        format: 'image/jpeg',
        detectRetina: true,
    })
    var verkehrLayer = L.tileLayer.wms("https://wms.geo.admin.ch/?", {
        layers: ['ch.swisstopo.pixelkarte-grau', 'ch.swisstopo.swisstlm3d-strassen', 'ch.swisstopo.swisstlm3d-eisenbahnnetz', 'ch.swisstopo.swisstlm3d-uebrigerverkehr'],
        format: 'image/jpeg',
        detectRetina: true,
    })
    var haltestellenLayer = L.tileLayer.wms("https://wms.geo.admin.ch/?", {
        layers: ['ch.swisstopo.pixelkarte-grau', 'ch.bav.schienennetz', 'ch.bav.haltestellen-oev'],
        format: 'image/jpeg',
        detectRetina: true,
    })

    // Add layer control to switch between different map types
    drawnItems.addTo(map);
    L.control.layers({
        "Google": streets_layer,
        "Satellite": satellite_layer,
        "Wandern": swissTopoLayer,
        "Verkehr": verkehrLayer,
        "Haltestellen": haltestellenLayer,
    }, { 'drawlayer': drawnItems }).addTo(map);

    // Add location control to the map
    var locate = new L.Control.SimpleLocate({
        position: "bottomright",
        className: "button-locate",
        afterClick: (result) => {
            // Do something after the button is clicked.
        },
        afterMarkerAdd: () => {
            // Do something after the marker (displaying the device's location and orientation) is added.
        },
        afterDeviceMove: (event) => {
            // Do something after the device moves.
        }
    });

    locate.addTo(map);


    map.addControl(new L.Control.Draw({
        position: "topright",
        edit: {
            featureGroup: drawnItems,
            poly: {
                allowIntersection: true
            },
        },
        draw: {
            polygon: {
                allowIntersection: true,
                showArea: true
            },
            circle: true
        },
    }));

    map.on(L.Draw.Event.CREATED, function (event) {
        drawnItems.addLayer(event.layer);
    });


    // Add dark mode toggle control
    L.Control.ToggleDarkMode = L.Control.extend({
        options: {
            position: 'bottomleft' // Default position for the control
        },

        onAdd: function (map) {
            this._button = L.DomUtil.create('button', 'leaflet-control-toggle-darkmode');
            this._button.innerHTML = '<i class="fa fa-moon"></i>';

            L.DomEvent.on(this._button, 'click', this._toggleDarkMode, this);
            // Set darkmode by default
            if (!localStorage.getItem('darkMode') || localStorage.getItem('darkMode') === 'true') {
                this._toggleDarkMode()
            }

            return this._button;
        },

        onRemove: function (map) {
            L.DomEvent.off(this._button, 'click', this._toggleDarkMode, this);
        },

        _toggleDarkMode: function () {
            if (L.DomUtil.hasClass(document.body, 'dark-mode')) {
                // If dark mode is active, remove the class to revert to light mode
                document.body.classList.remove('dark-mode');
                this._button.innerHTML = '<i class="fa fa-moon"></i>';
                localStorage.setItem('darkMode', 'false');
            } else {
                // If dark mode is not active, add the class to enable dark mode
                document.body.classList.add('dark-mode');
                this._button.innerHTML = '<i class="fa fa-sun"></i>';
                localStorage.setItem('darkMode', 'true');
            }
        }
    });

    L.control.toggleDarkMode = function (opts) {
        return new L.Control.ToggleDarkMode(opts);
    }
    L.control.toggleDarkMode().addTo(map);

    // Add search control to the map
    var searchControl = new L.esri.Geocoding.geosearch().addTo(map);
    const results = L.layerGroup().addTo(map);

    searchControl.on("results", function (data) {
        results.clearLayers();
        for (let i = data.results.length - 1; i >= 0; i--) {
            results.addLayer(L.marker(data.results[i].latlng));
        }
    });


    // Add the default streets layer to the map
    streets_layer.addTo(map);

    // Define the 'everything' polygon (entire world)
    everything = turf.polygon([[[360, -90], [360, 90], [-360, 90], [-360, -90], [360, -90]]]);
}

/**
 * Adds a new clue to the clues array and updates localStorage.
 * @param {Object} clueData - The data for the new clue.
 */
function addClueToList(clueData) {
    // Add the new clue data to the array
    clueData["id"] = Math.random().toString(16).slice(2);
    clueData["timestamp"] = new Date().getTime();
    clues.push(clueData);

    // Update localStorage with the updated array
    localStorage.setItem('clues', JSON.stringify(clues));
    updateCluesHTML();
}

/**
 * Updates the map with polygons representing all clues.
 */
function updateCluesPolygon() {
    // Remove existing clue polygons from the map
    Object.values(clue_polygons).forEach((polygon) => {
        polygon.remove();
    });

    // Add new polygons for each clue
    clues.forEach(async function (clue) {
        if (!clue["hidden"]) {
            var polygon;
            if (clue["type"] === "Radius") {
                var coords = clue["location"]["feature"]["geometry"];
                polygon = turf.circle([coords.x, coords.y], clue.radius, { steps: 64, units: 'kilometers' })
                if (!clue["inverted"]) {
                    polygon = turf.difference(turf.featureCollection([everything, polygon]))
                }
            }
            if (clue["type"] === "Directional") {
                var coords = clue["location"]["feature"]["geometry"];
                if (clue["direction"] == "West") {
                    polygon = turf.polygon([[[coords.x, -90], [coords.x, 90], [360, 90], [360, -90], [coords.x, -90]]]);
                }
                else if (clue["direction"] == "East") {
                    polygon = turf.polygon([[[coords.x, -90], [coords.x, 90], [-360, 90], [-360, -90], [coords.x, -90]]]);
                }
                else if (clue["direction"] == "North") {
                    polygon = turf.polygon([[[360, coords.y], [360, -90], [-360, -90], [-360, coords.y], [360, coords.y]]]);
                }
                else if (clue["direction"] == "South") {
                    polygon = turf.polygon([[[360, coords.y], [360, 90], [-360, 90], [-360, coords.y], [360, coords.y]]]);
                }
                if (clue["inverted"]) {
                    polygon = turf.difference(turf.featureCollection([everything, polygon]))
                }
            }
            if (clue["type"] === "Region") {
                // Load polygon data if not loaded yet
                if (!polygon_json[clue["polygon_path"]]) {
                    await load_json(clue["polygon_path"])
                        .then(polygon => {
                            polygon = turf.polygon(polygon);
                            // polygon = turf.simplify(polygon, { tolerance: 0.0001 })
                            polygon_json[clue["polygon_path"]] = polygon.geometry.coordinates;
                        });
                }
                if (clue["inverted"]) {
                    polygon = turf.polygon(polygon_json[clue["polygon_path"]])

                } else {
                    // HACK, difference did not work when there were too muliple sub-regions, but just prepending the "everything" array did the trick
                    p = JSON.parse(JSON.stringify(polygon_json[clue["polygon_path"]]));
                    p.unshift([[360, -90], [360, 90], [-360, 90], [-360, -90], [360, -90]])
                    polygon = turf.polygon(p)
                }
            }
            if (clue["type"] === "Drawing") {
                const polygons = clue.geoJSON.features.filter(feature =>
                    ['Polygon', 'MultiPolygon'].includes(feature.geometry.type)
                );

                if (polygons.length > 0) {
                    polygon = polygons.length > 1
                        ? turf.union(turf.featureCollection(polygons))
                        : polygons[0];

                    if (!clue.inverted) {
                        polygon = turf.difference(turf.featureCollection([everything, polygon]));
                    }

                    const nonPolygonFeatures = clue.geoJSON.features.filter(feature =>
                        !['Polygon', 'MultiPolygon'].includes(feature.geometry.type)
                    );

                    polygon = {
                        type: "FeatureCollection",
                        features: [polygon, ...nonPolygonFeatures]
                    };
                }
                else {
                    polygon = clue.geoJSON
                }

            }

            var color = await getClueColor(clue["clueGiver"]);
            clue_polygons[clue["id"]] = L.geoJSON(polygon, {
                color: color,
                fillColor: getComputedStyle(document.body).getPropertyValue('--border-color'),
                fillOpacity: 0.5
            }).addTo(map);
        }
    });
}

/**
 * Updates the HTML display of clues in the control list.
 */
function updateCluesHTML() {
    const controlList = document.getElementById('control-list');
    if (!clueTemplate) {
        clueTemplate = document.getElementById("clue-container-template");
    }

    controlList.innerHTML = "";

    let clueCounter = 0;
    clues.forEach(async function (clue) {
        const listItem = document.createElement('li');
        listItem.className = 'clue-container';

        const text = getClueText(clue);
        const color = await getClueColor(clue.clueGiver);

        var date = new Date(clue.timestamp);

        listItem.innerHTML = clueTemplate.innerHTML;

        function updateElement(id, content) {
            const element = listItem.querySelector(`#${id}-template`);
            element.id = `${id}-${clueCounter}`;
            element.textContent = content;
            return element;
        }

        const clueTextElement = updateElement("clue-text", text);
        const clueNotes = updateElement("clue-notes", clue.notes);
        updateElement("clue-timestamp", date.toISOString().slice(0, 16).replaceAll("T", " "));
        updateElement("clue-giver", clue.clueGiver);

        clueNotes.addEventListener('input', function () {
            // Update the notes in the clues object
            clue.notes = this.textContent;

            // Save the updated clues object to localStorage
            localStorage.setItem('clues', JSON.stringify(clues));
        });

        const clueGiverElement = listItem.querySelector(`#clue-giver-${clueCounter}`);
        if (clueGiverElement) {
            clueGiverElement.style.backgroundColor = color;
        }

        // Find the invert checkbox within the listItem
        var invertCheckbox = listItem.querySelector('.invert-toggle');
        if (clue["inverted"]) {
            invertCheckbox.classList.add('inverted');
        } else {
            invertCheckbox.classList.remove('inverted');
        }

        // Add event listener to invert toggle to update clue and text
        invertCheckbox.addEventListener('click', function () {

            clue["inverted"] = !clue["inverted"]
            clueTextElement.textContent = getClueText(clue);

            this.classList.add('spin');

            // Remove spin class after animation completes
            setTimeout(() => {
                this.classList.remove('spin');
            }, 500);

            if (clue["inverted"]) {
                this.classList.add('inverted');
            } else {
                this.classList.remove('inverted');
            }
            localStorage.setItem('clues', JSON.stringify(clues));
            updateCluesPolygon();
        });


        // Find the hide checkbox within the listItem
        var visibilityToggle = listItem.querySelector('.visibility-toggle');
        if (clue["hidden"]) {
            const clueContainer = visibilityToggle.closest('.clue-container');
            clueContainer.classList.add('hidden');
            visibilityToggle.innerHTML = '<i class="fas fa-eye"></i>'
        }
        else {
            const clueContainer = visibilityToggle.closest('.clue-container');
            clueContainer.classList.remove('hidden');
            visibilityToggle.innerHTML = '<i class="fas fa-eye-slash"></i>'
        }

        // Add event listener to hide checkbox to update clue and text
        visibilityToggle.addEventListener('click', function () {
            clue["hidden"] = !clue["hidden"]
            if (clue["hidden"]) {
                const clueContainer = this.closest('.clue-container');
                clueContainer.classList.add('hidden');
                visibilityToggle.innerHTML = '<i class="fas fa-eye"></i>'
            }
            else {
                const clueContainer = this.closest('.clue-container');
                clueContainer.classList.remove('hidden');
                visibilityToggle.innerHTML = '<i class="fas fa-eye-slash"></i>'
            }

            localStorage.setItem('clues', JSON.stringify(clues));
            updateCluesPolygon();
            // updateCluesHTML(); // Update the clue text
        });

        var deleteButton = listItem.querySelector('.delete-button');
        deleteButton.addEventListener('click', function () {
            if (confirm(`Are you sure you want to delete the clue "${text}"?`)) {
                var index = clues.findIndex(function (item) { // Find the index of the clue in the clues array
                    return item["id"] === clue["id"];
                });
                if (index !== -1) { // If the clue exists in the clues array
                    clues.splice(index, 1); // Remove it from the array
                }
                localStorage.setItem('clues', JSON.stringify(clues));
                clues = JSON.parse(localStorage.getItem('clues')) || [];
                updateCluesHTML();
            }
        });
        // Append the list item to the controlList
        controlList.appendChild(listItem);

        clueCounter += 1;

    });
    updateCluesPolygon()
}

// Helper functions
function getClueText(clue) {
    if (clue.type === "Radius") {
        if (!clue.inverted) {
            return `Within ${clue.radius}km of ${clue.place}`;
        }
        else {
            return `Not within ${clue.radius}km of ${clue.place}`;
        }
    } else if (clue.type === "Directional") {
        if (!clue.inverted) {
            return `To the ${clue.direction} of ${clue.place}`;
        }
        else {
            const opposites = {
                "West": "East",
                "East": "West",
                "North": "South",
                "South": "North"
            }
            return `To the ${opposites[clue.direction]} of ${clue.place}`;
        }
    } else if (clue.type === "Region") {
        if (clue.region.includes("Altitude")) {
            if (!clue.inverted) {
                return clue.region;
            }
            else {
                return clue.region.replace("above", "below");
            }
        }
        else {
            if (!clue.inverted) {
                return `In ${clue.region}`;
            }
            else {
                return `Not in ${clue.region}`;
            }
        }
    } else if (clue.type === "Drawing") {
        const n = parseInt(clue.id, 16);
        const idx1 = n % wordlist.length;
        const idx2 = Math.floor(n / wordlist.length) % wordlist.length;

        if (!clue.inverted) {
            return `Inside of Drawing ${wordlist[idx1]}-${wordlist[idx2]}`;
        }
        else {
            return `Outside of Drawing ${wordlist[idx1]}-${wordlist[idx2]}`;
        }
    }
    return "Unknown clue type";
}

async function getClueColor(clueGiver) {
    if (!participants) {
        participants = await load_json("config/participants.json")
    }
    const participant = participants.find(p => p.name === clueGiver);
    return participant ? participant.color : "#95a5a6";
}

function showPopup() {
    document.getElementById('popup-overlay').classList.add('active');
}

function hidePopup() {
    document.getElementById('popup-overlay').classList.remove('active');
}

function exportData() {
    const data = {
        version: FILE_VERSION,
    };
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        data[key] = localStorage.getItem(key);
    }

    const jsonData = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const dateString = now.toISOString().replaceAll(":", "-").split(".")[0]; // YYYY-MM-DD format

    const a = document.createElement('a');
    a.href = url;
    a.download = `export_${dateString}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importData() {
    if (!confirm("Warning: This will overwrite your current data. Are you sure you want to proceed?")) {
        return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = e => {
        const file = e.target.files[0];
        const reader = new FileReader();

        reader.onload = function (event) {
            try {
                const jsonData = JSON.parse(event.target.result);
                if (jsonData.version !== FILE_VERSION) {
                    showNotification(`File version not compatible, was ${jsonData.version}, expected ${FILE_VERSION}`, error = true);
                    console.error('Import error:', error);
                    return
                }
                localStorage.clear(); // Clear existing data
                for (const [key, value] of Object.entries(jsonData)) {
                    localStorage.setItem(key, value);
                }
                showNotification('Data imported successfully!');
                clues = JSON.parse(localStorage.getItem('clues')) || [];
                updateCluesHTML();
            } catch (error) {
                showNotification('Error importing data. Please make sure the file is a valid JSON.', error = true);
                console.error('Import error:', error);
            }
        };

        reader.readAsText(file);
    };

    input.click();
}

async function popup() {
    // Open Popup
    document.getElementById('add-control-btn').addEventListener('click', showPopup);

    // Update clue giver
    const clueGiverElement = document.getElementById("clue-giver")
    if (!participants) {
        participants = await load_json("config/participants.json")
    }
    participants.forEach(participant => {
        const option = document.createElement('option');
        option.value = participant.name;
        option.textContent = participant.name;
        clueGiverElement.appendChild(option);
    });


    // Switch Popup Tabs
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    var activeClueType = "Radius";

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');

            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            button.classList.add('active');

            // Active in all tabs
            document.getElementById("popup-clue-giver").classList.add("active");
            document.getElementById("popup-notes").classList.add("active");

            // Active in specific tabs
            if (tabId === "popup-radius") {
                activeClueType = "Radius";
                document.getElementById("popup-radius").classList.add("active");
                document.getElementById("popup-place").classList.add("active");
            }
            else if (tabId === "popup-direction") {
                document.getElementById("popup-direction").classList.add("active");
                document.getElementById("popup-place").classList.add("active");
                activeClueType = "Directional";
            }
            else if (tabId === "popup-region") {
                document.getElementById("popup-region").classList.add("active");
                activeClueType = "Region";
            } else if (tabId === "popup-drawing") {
                activeClueType = "Drawing"
            }
            // document.getElementById(tabId).classList.add('active');
        });
    });

    // Select Region with Hints
    const regionInput = document.getElementById('clue-region-input');
    const hints = document.getElementById('clue-hints');

    let debounceTimer;

    regionInput.addEventListener('input', function () {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const query = this.value.trim();
            if (query.length > 0) {
                fetchRegionSuggestions(query);
            } else {
                hints.style.display = 'none';
            }
        }, 300);
    });

    async function fetchRegionSuggestions(query) {
        try {
            // Search data with Fuse based on user input
            const results = region_fuse.search(query);
            updateSuggestions(results.map(result => result.item.name), 'clue-region-input');

        } catch (error) {
            console.error('Error fetching suggestions:', error);
        }
    }

    // Select Place with Hints
    const placeInput = document.getElementById('clue-place-input');

    placeInput.addEventListener('input', function () {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const query = this.value.trim();
            if (query.length > 0) {
                fetchPlaceSuggestions(query);
            } else {
                hints.style.display = 'none';
            }
        }, 300);
    });

    async function fetchPlaceSuggestions(query) {
        try {
            const response = await fetch(`https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest?text=${query}&f=json`);
            const data = await response.json();
            updateSuggestions(data.suggestions.map(result => result.text), 'clue-place-input');
        } catch (error) {
            console.error('Error fetching suggestions:', error);
        }
    }

    function updateSuggestions(suggestions, inputId) {
        hints.innerHTML = '';
        if (suggestions.length > 0) {
            suggestions.forEach(place => {
                const li = document.createElement('li');
                li.textContent = place;
                li.addEventListener('click', () => selectSuggestion(place, inputId));
                hints.appendChild(li);
            });
            hints.style.display = 'block';
        } else {
            hints.style.display = 'none';
        }
    }

    function selectSuggestion(text, inputId) {
        document.getElementById(inputId).value = text
        hints.style.display = 'none';
    }

    // Close suggestions when clicking outside
    document.addEventListener('click', function (event) {
        if (!hints.contains(event.target)) {
            hints.style.display = 'none';
        }
    });

    // Submit new Clue
    document.getElementById('submit-clue').addEventListener('click', function () {
        var clueData = {
            type: activeClueType,
            clueGiver: document.getElementById('clue-giver').value,
            notes: document.getElementById('clue-notes').value,
            inverted: false,
            hidden: false
        }

        if (clueData["type"] === 'Radius') {
            clueData["place"] = document.getElementById('clue-place-input').value;

            const radiusString = document.getElementById('clue-radius').value
            const radiusNumber = Number(radiusString);
            if (radiusString == "" || isNaN(radiusNumber) || radiusNumber < 0) {
                showNotification("Invalid radius.", error = true)
                return;
            }
            clueData["radius"] = radiusNumber;
        } else if (clueData["type"] === 'Directional') {
            clueData["direction"] = document.getElementById('clue-direction').value;
            clueData["place"] = document.getElementById('clue-place-input').value;
        } else if (clueData["type"] === 'Drawing') {
            console.log(drawnItems)

            // Filter circle objects
            const circleObjects = [];
            drawnItems.eachLayer(layer => {
                if (layer.options.radius && layer.options.radius > 0) {
                    circleObjects.push(layer);
                }
            });

            // Remove circles from drawnItems
            circleObjects.forEach(circle => {
                drawnItems.removeLayer(circle);
            });

            // Convert circles to polygon features
            const circlePolygons = circleObjects.map(circle => {
                const center = circle.getLatLng();
                return turf.circle([center.lng, center.lat], circle.options.radius / 1000, {
                    steps: 64,
                    units: 'kilometers'
                });
            });

            clueData["geoJSON"] = drawnItems.toGeoJSON();
            clueData["geoJSON"].features = clueData["geoJSON"].features.concat(circlePolygons);

            console.log(circlePolygons)
            console.log(clueData["geoJSON"])

            drawnItems.clearLayers();
            addClueToList(clueData);
            hidePopup();
            return;
        }

        // Show Suggestions
        if (clueData["type"] === 'Region') {
            const result = region_fuse.search(document.getElementById('clue-region-input').value);
            if (result && result.length > 0) {
                clueData["region"] = result[0].item.name;
                clueData["polygon_path"] = result[0].item.filename;
                addClueToList(clueData);
                hidePopup();
            }
            else {
                showNotification("No region found with that name.", error = true)
            }
        }
        else if (clueData["type"] === 'Radius' || clueData["type"] === 'Directional') {

            fetch(`https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/find?text=${encodeURIComponent(clueData["place"])}&f=json`)
                .then(response => response.json())
                .then(data => {
                    // Extract the coordinates from the response
                    if (data.locations && data.locations.length > 0) {
                        clueData["location"] = data.locations[0];
                        clueData["place"] = data.locations[0].name;
                        // Add the clue to the list
                        addClueToList(clueData);
                        hidePopup();
                    }
                    else {
                        showNotification("No place found with that name.", error = true)
                    }
                });
        }

    });

    // Cancel popup
    document.getElementById('close-popup').addEventListener('click', function () {
        hidePopup();
    });

    document.getElementById('export-button').addEventListener('click', exportData);
    document.getElementById('import-button').addEventListener('click', importData);

    // Fullscreen
    document.getElementById('fullscreen-button').addEventListener('click', toggleFullscreen);

    // Update icon on change
    document.addEventListener("fullscreenchange", updateFullscreenButtonIcon);
    document.addEventListener("webkitfullscreenchange", updateFullscreenButtonIcon); // Chrome, Safari and Opera
    document.addEventListener("mozfullscreenchange", updateFullscreenButtonIcon); // Firefox
    document.addEventListener("MSFullscreenChange", updateFullscreenButtonIcon); // IE/Edge

}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        } else if (document.documentElement.mozRequestFullScreen) { // Firefox
            document.documentElement.mozRequestFullScreen();
        } else if (document.documentElement.webkitRequestFullscreen) { // Chrome, Safari and Opera
            document.documentElement.webkitRequestFullscreen();
        } else if (document.documentElement.msRequestFullscreen) { // IE/Edge
            document.documentElement.msRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.mozCancelFullScreen) { // Firefox
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) { // Chrome, Safari and Opera
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) { // IE/Edge
            document.msExitFullscreen();
        }
    }
}

function updateFullscreenButtonIcon() {
    const icon = document.getElementById('fullscreen-button').querySelector('i');
    if (document.fullscreenElement) {
        icon.classList.remove('fa-expand');
        icon.classList.add('fa-compress');
    } else {
        icon.classList.remove('fa-compress');
        icon.classList.add('fa-expand');
    }
}

// Init everything once DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    popup();
    initMap();
    updateCluesHTML();
});

