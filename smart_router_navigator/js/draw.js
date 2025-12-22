import { graph } from "./graph.js";
import { map } from "./map.js";

let routeLayer;

export function drawRoute(path) {
    console.log("🎨 Rota çiziliyor...", path.length, "node");

    // Eski rotayı temizle
    if (routeLayer) {
        map.removeLayer(routeLayer);
    }

    if (!path || path.length < 2) {
        console.warn("Çizilecek rota yok!");
        return;
    }

    const coords = [];
    let totalDistance = 0;

    // Path boyunca tüm koordinatları topla
    // draw.js içindeki döngü kısmının mantığı
    for (let i = 0; i < path.length - 1; i++) {
        const u = path[i];
        const v = path[i + 1];
        const edge = graph.adj.get(u)?.find(e => e.to === v);

        if (edge && edge.geom) {
            // Eğer edge.geom varsa, gerçek yol kıvrımlarını ekle
            coords.push(...edge.geom);
        } else {
            // Yoksa mecburen düz çizgi (node'lar arası)
            const n1 = graph.nodes.get(u);
            const n2 = graph.nodes.get(v);
            coords.push([n1.lat, n1.lon], [n2.lat, n2.lon]);
        }
    }

    console.log(`   • Toplam ${coords.length} koordinat`);
    console.log(`   • Mesafe: ${(totalDistance / 1000).toFixed(2)} km`);

    if (coords.length === 0) {
        console.error("❌ Hiç koordinat bulunamadı!");
        return;
    }

    // Rotayı çiz - KALIN VE GÖRÜNÜR
    routeLayer = L.polyline(coords, {
        color: "#6b58d6",       // Mor
        weight: 8,              // Kalın çizgi
        opacity: 0.9,           // Yarı saydam
        lineJoin: 'round',      // Yumuşak köşeler
        lineCap: 'round'        // Yumuşak uçlar
    }).addTo(map);

    // Haritayı rotaya zoom yap
    map.fitBounds(routeLayer.getBounds(), {
        padding: [50, 50],
        maxZoom: 15
    });

    // Rotanın üzerine animasyon ekle
    let offset = 0;
    const animate = () => {
        offset = (offset + 1) % 20;
        if (routeLayer && map.hasLayer(routeLayer)) {
            routeLayer.setStyle({
                dashArray: `10, 10`,
                dashOffset: offset
            });
            requestAnimationFrame(animate);
        }
    };
    animate();

    console.log("✅ Rota çizildi ve harita zoom yapıldı");

    // Global'e kaydet
    window.routeLayer = routeLayer;
}

// Rotayı temizle
export function clearRoute() {
    if (routeLayer && map) {
        map.removeLayer(routeLayer);
        routeLayer = null;
        window.routeLayer = null;
    }
}