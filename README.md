# GeoClues

GeoClues is an interactive web application I built for a weekend with my friends. Using the Leaflet.js library to render maps, it allows users to plot clues and hints directly on the map. All data is stored locally, so all files can be statically hosted.

## Features

- **Responsive Design:** Optimized for mobile use, ensuring a smooth experience on smartphones.
- **Interactive Map:** Use Leaflet.js to display and interact with maps.
- **Clue Management:** Add, invert, hide, and delete clues with various parameters like radius, direction, region, or altitude.
- **Local Storage:** All data is stored locally on the device and can be exported/imported.

## Demo

![GeoClues Screenshot](screenshot.png)

## Demo

A demo of this is hosted at [pascscha.ch/geoclues](https://pascscha.ch/geoclues)

### Usage

1. **Adding Clues:** Click the `+` button to add a new clue. Fill in the details in the popup form and click "Add Clue."
2. **Managing Clues:** Use the control panel to edit or delete existing clues. Toggle their visibility or invert the clue for more challenging gameplay.
3. **Export/Import Data:** Use the import/export buttons to save your current clues to a file or load clues from a file.

## Built With

- [Leaflet.js](https://leafletjs.com/) - An open-source JavaScript library for mobile-friendly interactive maps.
- [ESRI Leaflet](https://esri.github.io/esri-leaflet/) - A lightweight set of tools for using ArcGIS services with Leaflet.
- [Turf.js](http://turfjs.org/) - Advanced geospatial analysis for browsers and Node.js.
- [Fuse.js](https://fusejs.io/) - Lightweight fuzzy-search library.

## License

This project is free software and licensed under the GPLv3 License - see the [LICENSE.md](LICENSE.md) file for details. However, it's dependencies are not necessarily
