// js/main.js - Görsel Rota Sistemi

import { initMap, map } from './map.js';
import { loadGraph, graph } from './graph.js';
import { dijkstra } from './routing.js';
import { drawRoute, clearRoute } from './draw.js';
import { nearestRoadNode } from './snap.js';
import { getTrafficWeight } from './traffic.js';

// Global değişkenler
window.selectedStart = null;
window.selectedEnd = null;
window.startMarker = null;
window.endMarker = null;
window.selectionStep = null;
window.stops = [];
window.stopMarkers = [];
window.lastCalculatedDistance = null;

// DOM yüklendiğinde
document.addEventListener('DOMContentLoaded', async function () {
    console.log("🚀 Uygulama başlatılıyor...");

    try {
        initMap();
        window.map = map;

        await loadGraph();
        console.log("✅ Graph yüklendi:", graph.nodes.size, "node");

        setupEventListeners();
        updateStopList();

        console.log("✅ Uygulama hazır!");
    } catch (error) {
        console.error("❌ Başlatma hatası:", error);
    }
});

// Event listener'lar
function setupEventListeners() {
    const selectBtn = document.getElementById('selectPointsBtn');
    const calcBtn = document.getElementById('calcBtn');
    const clearBtn = document.getElementById('clearBtn');
    const addStopBtn = document.getElementById('addStopBtn');

    if (selectBtn) selectBtn.addEventListener('click', startManualSelection);
    if (calcBtn) calcBtn.addEventListener('click', calculateRoute);
    if (clearBtn) clearBtn.addEventListener('click', clearAll);
    if (addStopBtn) addStopBtn.addEventListener('click', addStopClick);

    // Harita tıklama
    if (map) {
        map.on('click', onMapClick);
    }

    // Ulaşım modları
    const modeCards = document.querySelectorAll('.mode-card');
    modeCards.forEach(function (card) {
        card.addEventListener('click', function () {
            modeCards.forEach(function (c) {
                c.classList.remove('active');
            });
            card.classList.add('active');

            // Rota varsa süreleri güncelle
            if (window.lastCalculatedDistance) {
                updateAllModeTimes(window.lastCalculatedDistance);
                const activeMode = card.dataset.mode;
                updateRouteInfo(window.lastCalculatedDistance, activeMode);
            }
        });
    });
}

// Manuel nokta seçimi başlat
function startManualSelection() {
    console.log("📍 Manuel nokta seçimi başlatıldı");

    clearMarkers();
    window.selectedStart = null;
    window.selectedEnd = null;
    window.selectionStep = 'start';

    const selectBtn = document.getElementById('selectPointsBtn');
    const mapContainer = document.getElementById('map');

    if (selectBtn) {
        selectBtn.classList.add('selecting-mode');
        selectBtn.textContent = '🎯 BAŞLANGIÇ seçin...';
    }

    if (mapContainer) {
        mapContainer.classList.add('map-selecting');
    }

    const startInput = document.getElementById('start');
    const endInput = document.getElementById('end');
    if (startInput) startInput.value = '';
    if (endInput) endInput.value = '';
}

// Haritaya tıklama
function onMapClick(e) {
    console.log("🖱️ Harita tıklandı:", e.latlng);

    if (!graph || graph.nodes.size === 0) {
        console.error('Graph henüz yüklenmedi!');
        return;
    }

    const snapped = nearestRoadNode(e.latlng.lat, e.latlng.lng);
    if (!snapped) {
        console.warn('Yakın yol bulunamadı!');
        return;
    }

    // BAŞLANGIÇ SEÇİMİ
    if (window.selectionStep === 'start') {
        clearMarkers();

        window.startMarker = L.marker([snapped.lat, snapped.lon], {
            icon: L.divIcon({
                className: 'custom-marker start-marker',
                html: '<div style="background: #10b981; width: 32px; height: 32px; border-radius: 50%; border: 4px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 18px;">🏁</div>',
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            })
        }).addTo(map);

        window.startMarker.bindPopup('<b style="color: #10b981;">BAŞLANGIÇ</b><br>Node: ' + snapped.id);
        window.startMarker.openPopup();

        window.selectedStart = snapped;
        const startInput = document.getElementById('start');
        if (startInput) {
            startInput.value = 'Başlangıç - Node ' + snapped.id;
        }

        window.selectionStep = 'end';
        const selectBtn = document.getElementById('selectPointsBtn');
        if (selectBtn) {
            selectBtn.textContent = '🎯 BİTİŞ seçin...';
        }
    }
    // BİTİŞ SEÇİMİ
    else if (window.selectionStep === 'end') {
        window.endMarker = L.marker([snapped.lat, snapped.lon], {
            icon: L.divIcon({
                className: 'custom-marker end-marker',
                html: '<div style="background: #ef4444; width: 32px; height: 32px; border-radius: 50%; border: 4px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 18px;">🎯</div>',
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            })
        }).addTo(map);

        window.endMarker.bindPopup('<b style="color: #ef4444;">BİTİŞ</b><br>Node: ' + snapped.id);
        window.endMarker.openPopup();

        window.selectedEnd = snapped;
        const endInput = document.getElementById('end');
        if (endInput) {
            endInput.value = 'Bitiş - Node ' + snapped.id;
        }

        window.selectionStep = null;

        const mapContainer = document.getElementById('map');
        const selectBtn = document.getElementById('selectPointsBtn');

        if (mapContainer) mapContainer.classList.remove('map-selecting');
        if (selectBtn) {
            selectBtn.classList.remove('selecting-mode');
            selectBtn.textContent = '🗺️ Nokta Seç (Başlangıç→Bitiş)';
        }

        // Otomatik olarak rotayı hesapla
        setTimeout(calculateRoute, 300);
    }
    // DURAK SEÇİMİ
    else if (window.selectionStep === 'stop') {
        addStopAtLocation(snapped);
    }
}

// Rota hesapla
function calculateRoute() {
    if (!window.selectedStart || !window.selectedEnd) {
        console.warn('Başlangıç ve bitiş noktası gerekli!');
        return;
    }

    console.log("🔍 Rota hesaplanıyor...");

    // Trafik fonksiyonu
    const trafficSelect = document.getElementById('traffic');
    const trafficLevel = trafficSelect ? trafficSelect.value : 'medium';

    const trafficFn = function () {
        const base = getTrafficWeight();
        if (trafficLevel === 'light') return base * 0.8;
        if (trafficLevel === 'heavy') return base * 1.5;
        return base;
    };

    // Dijkstra ile yol bul
    const path = dijkstra(window.selectedStart.id, window.selectedEnd.id, trafficFn);

    if (!path || path.length < 2) {
        console.error('Yol bulunamadı!');
        return;
    }

    console.log('✅ Yol bulundu: ' + path.length + ' node');

    // Rotayı çiz
    drawRoute(path);

    // Mesafe hesapla (geometriden)
    const distance = calculateDistanceFromGeometry(path);
    window.lastCalculatedDistance = distance;

    // Bilgileri göster
    const activeMode = document.querySelector('.mode-card.active');
    const mode = activeMode ? activeMode.dataset.mode : 'car';

    updateRouteInfo(distance, mode);
    updateAllModeTimes(distance);
    showDirections(path);

    console.log('📊 Rota bilgileri güncellendi');
}

// Geometriden mesafe hesapla (YOL ŞEKLİNE GÖRE)
function calculateDistanceFromGeometry(path) {
    let total = 0;

    for (let i = 0; i < path.length - 1; i++) {
        const edges = graph.adj.get(path[i]);
        if (!edges) continue;

        const edge = edges.find(function (e) {
            return e.to === path[i + 1];
        });

        if (edge && edge.geom && edge.geom.length > 1) {
            // Geometri üzerinden segment segment hesapla
            for (let j = 0; j < edge.geom.length - 1; j++) {
                const p1 = edge.geom[j];
                const p2 = edge.geom[j + 1];
                total += haversine(p1[0], p1[1], p2[0], p2[1]);
            }
        } else if (edge) {
            // Geometry yoksa düz mesafe
            total += edge.w;
        }
    }

    return total / 1000; // metre -> km
}

// Haversine mesafe fonksiyonu
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000; // metre
    const toRad = function (x) { return x * Math.PI / 180; };
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Basit mesafe hesapla (yedek)
function calculateDistance(path) {
    let total = 0;
    for (let i = 0; i < path.length - 1; i++) {
        const edges = graph.adj.get(path[i]);
        if (!edges) continue;
        const edge = edges.find(function (e) {
            return e.to === path[i + 1];
        });
        if (edge) total += edge.w;
    }
    return total / 1000; // km
}

// Süre hesapla
function calculateDuration(distanceKm, mode) {
    const speeds = {
        car: 50,   // km/h
        bike: 18,  // km/h
        walk: 5    // km/h
    };
    const speed = speeds[mode] || 50;
    return (distanceKm / speed) * 60; // dakika
}

// Tüm mod sürelerini güncelle
function updateAllModeTimes(distance) {
    const modes = ['car', 'bike', 'walk'];
    modes.forEach(function (mode) {
        const duration = calculateDuration(distance, mode);
        const card = document.querySelector('.mode-card[data-mode="' + mode + '"]');
        if (card) {
            const timeEl = card.querySelector('.mode-time');
            if (timeEl) {
                timeEl.textContent = Math.round(duration) + ' dk';
            }
        }
    });
}

// Rota bilgilerini güncelle
function updateRouteInfo(distance, mode) {
    mode = mode || 'car';
    const duration = calculateDuration(distance, mode);

    const distanceEl = document.getElementById('distance');
    const durationEl = document.getElementById('duration');
    const costEl = document.getElementById('cost');

    if (distanceEl) distanceEl.textContent = distance.toFixed(2) + ' km';
    if (durationEl) durationEl.textContent = Math.round(duration) + ' dk';
    if (costEl) costEl.textContent = Math.round(distance * 2.5) + ' TL';
}

// Yönlendirme adımları
function showDirections(path) {
    const directionsEl = document.getElementById('directions');
    if (!directionsEl) return;

    const totalNodes = path.length;
    const segments = [];

    // Her %25'te bir adım oluştur
    segments.push({
        step: 1,
        text: 'Başlangıç noktasından hareket edin',
        icon: '🏁'
    });

    segments.push({
        step: 2,
        text: 'Rotayı takip edin (%25 tamamlandı)',
        icon: '➡️'
    });

    segments.push({
        step: 3,
        text: 'Rotayı takip edin (%50 tamamlandı)',
        icon: '➡️'
    });

    segments.push({
        step: 4,
        text: 'Rotayı takip edin (%75 tamamlandı)',
        icon: '➡️'
    });

    segments.push({
        step: 5,
        text: 'Hedefe ulaştınız!',
        icon: '🎯'
    });

    let html = '';
    segments.forEach(function (seg) {
        html += '<div class="dirStep"><strong>' + seg.step + '.</strong> ' + seg.text + ' ' + seg.icon + '</div>';
    });

    directionsEl.innerHTML = html;
}

// Durak ekle butonu
function addStopClick() {
    window.selectionStep = 'stop';

    const selectBtn = document.getElementById('selectPointsBtn');
    if (selectBtn) {
        selectBtn.classList.add('selecting-mode');
        selectBtn.textContent = '📍 DURAK seçin...';
    }

    const mapContainer = document.getElementById('map');
    if (mapContainer) {
        mapContainer.classList.add('map-selecting');
    }
}

// Durak ekle
function addStopAtLocation(snapped) {
    const stopNumber = window.stops.length + 1;

    const stop = {
        id: Date.now(),
        lat: snapped.lat,
        lon: snapped.lon,
        nodeId: snapped.id,
        name: 'Durak ' + stopNumber
    };

    window.stops.push(stop);

    // Marker ekle
    const markerHtml = '<div style="background: #f59e0b; width: 28px; height: 28px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">' + stopNumber + '</div>';

    const marker = L.marker([snapped.lat, snapped.lon], {
        icon: L.divIcon({
            className: 'custom-marker stop-marker',
            html: markerHtml,
            iconSize: [34, 34],
            iconAnchor: [17, 17]
        })
    }).addTo(map);

    marker.bindPopup('<b>Durak ' + stopNumber + '</b><br>Node: ' + snapped.id);

    window.stopMarkers.push(marker);

    // Seçim modunu kapat
    window.selectionStep = null;

    const mapContainer = document.getElementById('map');
    const selectBtn = document.getElementById('selectPointsBtn');

    if (mapContainer) mapContainer.classList.remove('map-selecting');
    if (selectBtn) {
        selectBtn.classList.remove('selecting-mode');
        selectBtn.textContent = '🗺️ Nokta Seç (Başlangıç→Bitiş)';
    }

    updateStopList();
}

// Durak listesini güncelle
function updateStopList() {
    const listEl = document.getElementById('stopList');
    if (!listEl) return;

    if (window.stops.length === 0) {
        listEl.innerHTML = '<div class="stopItem"><span style="color: #999;">Henüz durak eklenmedi</span></div>';
        return;
    }

    listEl.innerHTML = '';
    window.stops.forEach(function (stop, index) {
        const div = document.createElement('div');
        div.className = 'stopItem';

        const stopText = '<strong>Durak ' + (index + 1) + '</strong> - Node ' + stop.nodeId;
        const btn = document.createElement('button');
        btn.className = 'stopBtn';
        btn.textContent = 'Sil';
        btn.onclick = function () {
            removeStop(index);
        };

        const span = document.createElement('span');
        span.innerHTML = stopText;

        div.appendChild(span);
        div.appendChild(btn);
        listEl.appendChild(div);
    });
}

// Durak sil
function removeStop(index) {
    if (window.stopMarkers[index]) {
        map.removeLayer(window.stopMarkers[index]);
    }

    window.stops.splice(index, 1);
    window.stopMarkers.splice(index, 1);

    updateStopList();
}

// Marker'ları temizle
function clearMarkers() {
    if (window.startMarker && map) map.removeLayer(window.startMarker);
    if (window.endMarker && map) map.removeLayer(window.endMarker);
    window.startMarker = null;
    window.endMarker = null;
}

// Temizle
function clearAll() {
    clearMarkers();
    clearRoute();

    // Durakları temizle
    window.stopMarkers.forEach(function (m) {
        map.removeLayer(m);
    });
    window.stops = [];
    window.stopMarkers = [];

    const startInput = document.getElementById('start');
    const endInput = document.getElementById('end');
    if (startInput) startInput.value = '';
    if (endInput) endInput.value = '';

    updateRouteInfo(0, 'car');
    updateStopList();

    // Süreleri sıfırla
    const timeElements = document.querySelectorAll('.mode-time');
    timeElements.forEach(function (el) {
        el.textContent = '-- dk';
    });

    // Directions temizle
    const directionsEl = document.getElementById('directions');
    if (directionsEl) {
        directionsEl.innerHTML = '<div class="dirStep">Rota hesaplanınca görüntülenecek</div>';
    }

    window.selectedStart = null;
    window.selectedEnd = null;
    window.selectionStep = null;
    window.lastCalculatedDistance = null;

    const mapContainer = document.getElementById('map');
    const selectBtn = document.getElementById('selectPointsBtn');

    if (mapContainer) mapContainer.classList.remove('map-selecting');
    if (selectBtn) {
        selectBtn.classList.remove('selecting-mode');
        selectBtn.textContent = '🗺️ Nokta Seç (Başlangıç→Bitiş)';
    }

    console.log("🗑️ Temizlendi");
}

console.log("✅ main.js yüklendi");