export let map;

export function initMap() {
    map = L.map("map").setView([37.2153, 28.3636], 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap"
    }).addTo(map);
}
