// scripts/verify-graph.js
// Simple verification that graph-data.json can be loaded and nodes are generated correctly.
const fs = require('fs');
const path = require('path');

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = x => x * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

async function loadGraph() {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'graph-data.json'), 'utf8'));
    const graph = { nodes: new Map(), adj: new Map() };

    // Node loading (same logic as in js/graph.js after our patch)
    if (Array.isArray(data.nodes)) {
        const spacing = 0.001;
        const centerLat = 37.2153;
        const centerLon = 28.3636;
        data.nodes.forEach((id, idx) => {
            const row = Math.floor(idx / 100);
            const col = idx % 100;
            const lat = centerLat + row * spacing;
            const lon = centerLon + col * spacing;
            graph.nodes.set(id, { lat, lon });
            graph.adj.set(id, []);
        });
    } else if (data.nodes && typeof data.nodes === 'object') {
        for (const [id, n] of Object.entries(data.nodes)) {
            if (n && typeof n.lat === 'number' && typeof n.lon === 'number') {
                graph.nodes.set(id, { lat: n.lat, lon: n.lon });
                graph.adj.set(id, []);
            }
        }
    }

    console.log('Loaded nodes:', graph.nodes.size);
    const first = graph.nodes.values().next().value;
    console.log('First node sample:', first);
}

loadGraph().catch(err => console.error('Error:', err));
