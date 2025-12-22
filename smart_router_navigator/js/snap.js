import { graph } from "./graph.js";
import { map } from "./map.js";

// Haversine distance calculation helper
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000; // metres
    const toRad = x => x * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
function writeStatus(message) {
    const statusEl = document.getElementById('status');
    if (statusEl) {
        statusEl.textContent = message;
    }
    console.log('Status:', message);
}

export function nearestRoadNode(lat, lon) {
    // Helper to compute closest point on a line segment (approximate in lat/lon space)
    function closestOnSegment(p1, p2) {
        const lat1 = p1[0], lon1 = p1[1];
        const lat2 = p2[0], lon2 = p2[1];
        const dLat = lat2 - lat1;
        const dLon = lon2 - lon1;
        const len2 = dLat * dLat + dLon * dLon;
        if (len2 === 0) return { lat: lat1, lon: lon1 };
        const t = ((lat - lat1) * dLat + (lon - lon1) * dLon) / len2;
        const clampedT = Math.max(0, Math.min(1, t));
        return { lat: lat1 + clampedT * dLat, lon: lon1 + clampedT * dLon };
    }

    let best = null;
    let bestDist = Infinity;

    // Check all nodes first (fallback)
    for (const [id, node] of graph.nodes) {
        const d = haversine(lat, lon, node.lat, node.lon);
        if (d < bestDist) {
            bestDist = d;
            best = { id, lat: node.lat, lon: node.lon, dist: d };
        }
    }

    // Check all edges (use closest point on segment)
    const seen = new Set();
    for (const [nodeId, edges] of graph.adj) {
        for (const e of edges) {
            const key = `${nodeId}-${e.to}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const geom = e.geom;
            if (Array.isArray(geom) && geom.length === 2) {
                const [p1, p2] = geom;
                const proj = closestOnSegment(p1, p2);
                const d = haversine(lat, lon, proj.lat, proj.lon);
                if (d < bestDist) {
                    bestDist = d;
                    best = { id: null, lat: proj.lat, lon: proj.lon, dist: d };
                }
            }
        }
    }

    if (!best) {
        writeStatus("Seçilen noktanın yakınında yol bulunamadı.");
        return null;
    }
    console.log('nearestRoadNode: bestDist', bestDist);
    return best;
}

