/* eslint disable */

export const displayMap = (locations) => {
    mapboxgl.accessToken = 'pk.eyJ1IjoiYWJpdGVjaCIsImEiOiJjbDZ4eXFob2owa2t4M2lxbTVyNTcyMjQzIn0.EEZb7z9YmSgHBpM7dKuytw';
const map = new mapboxgl.Map({
    container: 'map', // container ID
    style: 'mapbox://styles/abitech/cl6y6sd1i00nu14pdo0hl26s1', // style URL
    scrollZoom: false
    // center: [-118.116524, 34.115720], // starting position [lng, lat]
    // zoom: 9, // starting zoom
    // projection: 'globe' // display the map as a 3D globe
});
map.on('style.load', () => {
    map.setFog({}); // Set the default atmosphere style
});

const bounds = new mapboxgl.LngLatBounds();

locations.forEach(loc => {
    const el = document.createElement('div');
    el.className = 'marker';

    new mapboxgl.Marker({
        element: el,
        anchor: 'bottom'
    }).setLngLat(loc.coordinates).addTo(map);

    new mapboxgl.Popup({
        offset: 30
    }).setLngLat(loc.coordinates)
    .setHTML(`<p>Day ${loc.day}: ${loc.description}</p>`).addTo(map);

    bounds.extend(loc.coordinates);
});

map.fitBounds(bounds, {
    padding: {
    top: 200,
    bottom: 150,
    left: 100,
    right: 100
}
});

}
