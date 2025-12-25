// js/main.js
import { dijkstra } from "./dijkstra.js";
import { optimizeRoute } from "./tsp.js";

let map;
let graphData = null;
let nodeCoordinates = {};

let selectedNodes = [];
let markers = [];
let routeLines = [];
let currentMode = 'car';
let selectingPoint = null;
// random commands

const speedModes = {
  car:40,
  bike: 10,
  walk: 3,
};



// 1) Haritayı başlat
map = L.map("map").setView([37.215, 28.365], 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap"
}).addTo(map);

function updateMapCursor(selecting) {
  map.getContainer().style.cursor = selecting ? 'crosshair' : '';
}

// 2) JSON yükle
fetch("./graph-data.json")
  .then(res => res.ok ? res.json() : Promise.reject("Dosya bulunamadı"))
  .then(async data => {
    console.log("📦 Veri yüklendi");
    graphData = data;

    if (Array.isArray(data.nodes)) {
      console.log(`📡 ${data.nodes.length} node için koordinatlar çekiliyor...`);
      showLoading(data.nodes.length);

      try {
        await fetchNodeCoordinates(data.nodes);
        const nodesObj = {};
        data.nodes.forEach(nodeId => {
          if (nodeCoordinates[nodeId]) {
            nodesObj[nodeId] = nodeCoordinates[nodeId];
          }
        });
        graphData.nodes = nodesObj;

        hideLoading();
        console.log(`✅ ${Object.keys(nodesObj).length} node yüklendi!`);
        normalizeEdges();
        cleanIsolatedNodes();

        // Tüm haritadan seç butonlarını aktif et
        document.querySelectorAll('.map-select-btn').forEach(btn => {
          btn.disabled = false;
        });

        // Durak ekleme butonu
        document.getElementById("addStopBtn").addEventListener("click", () => {
          const stop = createStopInput();
          document.getElementById("stop-list").appendChild(stop);
        });

      } catch (error) {
        hideLoading();
        alert("Koordinatlar yüklenemedi!");
      }
    } else {
      console.log(`✅ ${Object.keys(data.nodes).length} node hazır!`);
      normalizeEdges();
      
      // Tüm haritadan seç butonlarını aktif et
      document.querySelectorAll('.map-select-btn').forEach(btn => {
        btn.disabled = false;
      });

      // Durak ekleme butonu
      document.getElementById("addStopBtn").addEventListener("click", () => {
        const stop = createStopInput();
        document.getElementById("stop-list").appendChild(stop);
      });
    }
  })
  .catch(err => alert(`Hata: ${err}`));

function normalizeEdges() {
  if (!graphData.edges) return;
  console.log("🛠️ Veri onarılıyor: Tür dönüşümü, Çift Yön ve GEOMETRİ koruması...");

  const normalized = {};
  const validNodeIds = new Set();
  
  if (graphData.nodes) {
    Object.keys(graphData.nodes).forEach(k => validNodeIds.add(String(k)));
  }

  for (const sourceIdRaw in graphData.edges) {
    const sourceId = String(sourceIdRaw);
    const edges = graphData.edges[sourceIdRaw];

    if (!Array.isArray(edges)) continue;
    if (!normalized[sourceId]) normalized[sourceId] = [];

    edges.forEach(edge => {
      let targetNode = null;
      let weight = null;
      let geometry = null; // YENİ: Geometri verisini tutacak değişken

      // Veri formatını algıla
      if (Array.isArray(edge)) {
        targetNode = edge[0]; 
        weight = edge[1];
      } else if (typeof edge === 'object' && edge !== null) {
        targetNode = edge.node || edge.target || edge.to || edge.id; 
        weight = edge.weight || edge.distance || edge.cost;
        
        // YENİ: Eğer json'da geometry varsa onu al
        if (edge.geometry && Array.isArray(edge.geometry)) {
            geometry = edge.geometry;
        }
      } else {
        targetNode = edge;
      }

      if (!targetNode) return;
      const targetId = String(targetNode);
      const numWeight = Number(weight) || 50;

      if (!validNodeIds.has(targetId)) return;

      // --> A'dan B'ye yol ekle (Geometri ile birlikte)
      normalized[sourceId].push({ 
          node: targetId, 
          weight: numWeight,
          geometry: geometry // <--- KRİTİK EKLEME
      });

      // --> B'den A'ya yol ekle (Ters Yön)
      if (!normalized[targetId]) normalized[targetId] = [];
      
      const exists = normalized[targetId].find(e => e.node === sourceId);
      if (!exists) {
        // Ters yön için geometriyi ters çevirmemiz gerekir (A->B kıvrımı ile B->A kıvrımı terstir)
        let reverseGeometry = null;
        if (geometry) {
            reverseGeometry = [...geometry].reverse();
        }
          
        normalized[targetId].push({ 
            node: sourceId, 
            weight: numWeight,
            geometry: reverseGeometry // Ters yön geometrisi
        });
      }
    });
  }

  graphData.edges = normalized;
  console.log("✅ Edges onarıldı: String ID'ler, Çift Yön ve KIVRIMLAR (Geometry) korundu.");
}


function cleanIsolatedNodes() {
  if (!graphData?.nodes || !graphData?.edges) return;

  const connectedNodes = new Set();

  // Tüm bağlantıları kontrol et
  for (const nodeId in graphData.edges) {
    const edges = graphData.edges[nodeId];
    if (edges && edges.length > 0) {
      connectedNodes.add(nodeId);
      // Bağlı olduğu node'ları da ekle
      edges.forEach(edge => {
        if (edge.node) connectedNodes.add(edge.node);
      });
    }
  }

  // Yalıtılmış node'ları temizle
  const allNodeIds = Object.keys(graphData.nodes);
  const isolatedNodes = allNodeIds.filter(id => !connectedNodes.has(id));

  if (isolatedNodes.length > 0) {
    console.log(`🧹 ${isolatedNodes.length} yalıtılmış node temizleniyor...`);

    isolatedNodes.forEach(id => {
      delete graphData.nodes[id];
      delete graphData.edges[id];
    });

    // Graph'ı tekrar normalize et
    normalizeEdges();
  }
}


function showLoading(nodeCount) {
  const div = document.createElement('div');
  div.id = 'loading';
  div.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:30px;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.3);z-index:9999;text-align:center;';
  div.innerHTML = `
    <div style="font-size:48px;margin-bottom:15px;">⏳</div>
    <div style="font-size:18px;font-weight:bold;">Yol Ağı Hazırlanıyor...</div>
    <div style="color:#666;margin-top:10px;">OSM'den koordinatlar çekiliyor</div>
    <div style="margin-top:10px;font-size:14px;color:#999;">Toplam: ${nodeCount} nokta</div>
    <div id="progress" style="margin-top:10px;font-weight:bold;color:#3b82f6;">0%</div>
  `;
  document.body.appendChild(div);
}

function hideLoading() {
  const div = document.getElementById('loading');
  if (div) document.body.removeChild(div);
}

async function fetchNodeCoordinates(nodeIds) {
  const batchSize = 500;
  const batches = [];
  for (let i = 0; i < nodeIds.length; i += batchSize) {
    batches.push(nodeIds.slice(i, i + batchSize));
  }

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const query = `[out:json];node(id:${batch.join(',')});out;`;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    try {
      const response = await fetch(url);
      const result = await response.json();
      if (result.elements) {
        result.elements.forEach(el => {
          nodeCoordinates[el.id] = { lat: el.lat, lng: el.lon };
        });
      }
      const progress = Math.round(((i + 1) / batches.length) * 100);
      const progressEl = document.getElementById('progress');
      if (progressEl) progressEl.textContent = `${progress}%`;
      if (i < batches.length - 1) await new Promise(r => setTimeout(r, 1000));
    } catch (error) {
      console.error(`Batch ${i + 1} hatası:`, error);
    }
  }
}

/*en yakın yolu bulmak için  */
function findNearestNode(lat, lng) {
  if (!graphData?.nodes || !graphData?.edges) return null;

  const SEARCH_RADIUS_STEPS = [50, 100, 200, 300, 500]; // Kademeli arama

  let nearestId = null;
  let minDistance = Infinity;

  // Kademeli arama: önce yakındaki yolları ara, bulamazsan daha uzağa bak
  for (const radius of SEARCH_RADIUS_STEPS) {
    console.log(`🔍 ${radius}m yarıçapında yola bağlı node aranıyor...`);

    for (const id in graphData.nodes) {
      const node = graphData.nodes[id];
      if (!node?.lat || !node?.lng) continue;

      // Mesafeyi hesapla
      const R = 6371000;
      const dLat = (node.lat - lat) * Math.PI / 180;
      const dLng = (node.lng - lng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * Math.PI / 180) * Math.cos(node.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      // Eğer bu node radius içinde değilse atla
      if (distance > radius) continue;

      // Node'un bağlantıları var mı kontrol et (yola bağlı mı?)
      const hasConnections = graphData.edges[id] && graphData.edges[id].length > 0;

      // Eğer node'un bağlantısı yoksa, yola bağlı DEĞİL, geç!
      if (!hasConnections) continue;

      // Bu radius içindeki en yakın node'u bul
      if (distance < minDistance) {
        minDistance = distance;
        nearestId = id;
      }
    }

    // Eğer bu radius içinde bağlantılı node bulduysak, aramayı durdur
    if (nearestId) {
      const node = graphData.nodes[nearestId];
      const edgeCount = graphData.edges[nearestId]?.length || 0;
      console.log(`✅ ${radius}m içinde bulundu: ${nearestId} (${Math.round(minDistance)}m, ${edgeCount} bağlantı)`);

      // Seçilen node'un gerçekten yola bağlı olduğunu bir daha kontrol et
      if (edgeCount === 0) {
        console.warn(`⚠️ Node ${nearestId} bağlantısız! Daha uzakta aranıyor...`);
        nearestId = null; // Bulduğumuzu sıfırla, null yap ve daha uzakta adaha uzakta ara
        continue;
      }

      break;
    }
  }

  // Hiç bağlantılı node bulamazsak, ORJİNAL mantığa geri dön (en yakın node'u al)
  if (!nearestId) {
    console.warn("⚠️ Hiç bağlantılı node bulunamadı! En yakın node seçiliyor...");

    for (const id in graphData.nodes) {
      const node = graphData.nodes[id];
      if (!node?.lat || !node?.lng) continue;

      const R = 6371000;
      const dLat = (node.lat - lat) * Math.PI / 180;
      const dLng = (node.lng - lng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * Math.PI / 180) * Math.cos(node.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      if (distance < minDistance) {
        minDistance = distance;
        nearestId = id;
      }
    }

    if (nearestId) {
      const edgeCount = graphData.edges[nearestId]?.length || 0;
      console.log(`⚠️ Bağlantısız node seçildi: ${nearestId} (${Math.round(minDistance)}m, ${edgeCount} bağlantı)`);
    }
  }

  if (!nearestId) {
    console.error("❌ Hiçbir node bulunamadı!");
    alert("⚠️ Bu konum yakınında yol bulunamadı! Lütfen daha farklı bir konum seçin.");
  }

  return nearestId;
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateBearing(lat1, lng1, lat2, lng2) {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) - Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function getDirection(bearing) {
  const dirs = ["kuzeye", "kuzeydoğuya", "doğuya", "güneydoğuya", "güneye", "güneybatıya", "batıya", "kuzeybatıya"];
  return dirs[Math.round(bearing / 45) % 8];
}
 /*colored ikon renk importu gibi bişey */
function createColoredIcon(color) {
  return L.icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  });
}

const routeColors = ['#2563eb', '#7c3aed', '#059669', '#dc2626', '#f59e0b'];

function createColoredCircleIcon(color) {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        background:${color};
        width:16px;
        height:16px;
        border-radius:50%;
        border:3px solid white;
        box-shadow:0 0 4px rgba(0,0,0,0.5);
      "></div>
    `,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
}


// 3) Adres otomatik tamamlama
let searchTimeout;
document.getElementById("startInput")
document.getElementById("stopInput")
document.getElementById("endInput")

document.getElementById("start-autocomplete")
document.getElementById("stop-autocomplete")
document.getElementById("end-autocomplete")


startInput.addEventListener("input", (e) => handleAddressInput(e.target.value, "start"));
endInput.addEventListener("input", (e) => handleAddressInput(e.target.value, "end"));

async function handleAddressInput(query, type, dropdown, stopEl = null) {
  if (query.length < 3) {
    dropdown.classList.remove("show");
    return;
  }

  dropdown.innerHTML = `<div class="autocomplete-loading">🔍 Aranıyor...</div>`;
  dropdown.classList.add("show");

  const res = await fetch(
  `https://nominatim.openstreetmap.org/search` +
  `?format=json` +
  `&q=${encodeURIComponent(query)}` +
  `&countrycodes=tr` +
  `&viewbox=27.0,36.3,29.7,37.4` +
  `&bounded=1` +
  `&limit=5`
);

  const results = await res.json();

  dropdown.innerHTML = results.map(r => `
    <div class="autocomplete-item"
      data-lat="${r.lat}"
      data-lng="${r.lon}"
      data-name="${r.display_name}">
      📍 ${r.display_name}
    </div>
  `).join("");

  dropdown.querySelectorAll(".autocomplete-item").forEach(item => {
    item.onclick = () => {
      const lat = +item.dataset.lat;
      const lng = +item.dataset.lng;
      const name = item.dataset.name;

      selectStopFromAutocomplete(lat, lng, name, stopEl);
      dropdown.classList.remove("show");
    };
  });
}
/*burdan değiştirdil handle address ınputu  */

async function selectAddressFromAutocomplete(lat, lng, name, type) {
  if (!graphData?.nodes) {
    alert("Veri henüz yüklenmedi!");
    return;
  }

  const nearestId = findNearestNode(lat, lng);
  if (!nearestId) {
    alert("Bu adres yakınında yol bulunamadı!");
    return;
  }

  const coords = graphData.nodes[nearestId];
  const input = type === "start" ? startInput : endInput;
  input.value = name;

  // Eski marker'ı sil ve yenisini ekle
  if (type === "start") {
    if (selectedNodes[0]) {
      const oldMarkerIndex = 0;
      if (markers[oldMarkerIndex]) map.removeLayer(markers[oldMarkerIndex]);
      markers[oldMarkerIndex] = null;
    }
    selectedNodes[0] = nearestId;
    const marker = L.marker([coords.lat, coords.lng], { icon: createColoredIcon('green') })
      .addTo(map).bindPopup(`🟢 ${name}`).openPopup();
    markers[0] = marker;
  } else {
  // ✅ Eğer sadece başlangıç varsa bitiş indexi 1 olmalı
  const targetIndex = selectedNodes.length > 1 ? selectedNodes.length - 1 : 1;

  // Hedef indexte eski marker varsa sil
  if (markers[targetIndex]) map.removeLayer(markers[targetIndex]);

  selectedNodes[targetIndex] = nearestId;

  const marker = L.marker([coords.lat, coords.lng], { icon: createColoredIcon('red') })
    .addTo(map).bindPopup(`🔴 ${name}`).openPopup();

  markers[targetIndex] = marker;
}

  map.setView([coords.lat, coords.lng], 15);

  if (selectedNodes.length >= 2) {
    setTimeout(() => calculateRoute(), 500);
  }
}

// 4) "Haritadan Seç" butonları
document.getElementById("startMapBtn").addEventListener("click", () => {
  selectingPoint = 'start';
  updateMapCursor(true);
  document.getElementById("startMapBtn").classList.add("active");
  document.getElementById("endMapBtn").classList.remove("active");
});

document.getElementById("endMapBtn").addEventListener("click", () => {
  selectingPoint = 'end';
  updateMapCursor(true);
  document.getElementById("endMapBtn").classList.add("active");
  document.getElementById("startMapBtn").classList.remove("active");
});

// 5) Harita tıklaması
map.on("click", (e) => {
  if (!graphData?.nodes) {
    alert("❌ Veri henüz yüklenmedi!");
    return;
  }

  if (selectingPoint === "stop") {
  const nearestId = findNearestNode(e.latlng.lat, e.latlng.lng);
  if (!nearestId) return;

  const coords = graphData.nodes[nearestId];

  // Bitişten ÖNCE ekle
  const insertIndex = selectedNodes.length > 1 
    ? selectedNodes.length - 1 
    : selectedNodes.length;

  selectedNodes.splice(insertIndex, 0, nearestId);

  const color = routeColors[(insertIndex - 1) % routeColors.length];

const marker = L.marker([coords.lat, coords.lng], {
  icon: createColoredCircleIcon(color)
}).addTo(map);

marker.bindPopup(`
  <div style="display:flex;align-items:center;gap:6px">
    <strong>Durak ${insertIndex}</strong>
    <button
      onclick="removeStop(${insertIndex})"
      style="
        border:none;
        background:#ef4444;
        color:white;
        border-radius:4px;
        padding:2px 6px;
        cursor:pointer;
      "
    >✕</button>
  </div>
`);


  markers.splice(insertIndex, 0, marker);

  selectingPoint = "stop";
  updateMapCursor(true);

  updateStopList();
  if (selectedNodes.filter(n => n).length >= 2) {
  calculateRoute();
}

  return;
}


  if (!selectingPoint) {
    // Seçim modu aktif değilse direkt durak ekle (çoklu durak)
    const nearestId = findNearestNode(e.latlng.lat, e.latlng.lng);
    if (!nearestId) {
      alert("❌ Yakında yol bulunamadı!");
      return;
    }

    if (selectedNodes.includes(nearestId)) {
      alert("⚠️ Bu nokta zaten seçili!");
      return;
    }

    selectedNodes.push(nearestId);
    const coords = graphData.nodes[nearestId];

    let color = 'blue';
    if (selectedNodes.length === 1) color = 'green';
    else if (selectedNodes.length > 1) {
      if (markers.length > 0) {
        markers[markers.length - 1].setIcon(createColoredIcon('blue'));
      }
      color = 'red';
    }

    const marker = L.marker([coords.lat, coords.lng], { icon: createColoredIcon(color) })
      .addTo(map).bindPopup(`Durak ${selectedNodes.length}`).openPopup();
    markers.push(marker);
    updateUI();

    if (selectedNodes.length >= 2) {
      setTimeout(() => calculateRoute(), 500);
    }
    return;
  }

  // Seçim modu aktifse
  const nearestId = findNearestNode(e.latlng.lat, e.latlng.lng);
  if (!nearestId) {
    alert("❌ Yakında yol bulunamadı!");
    return;
  }

  const coords = graphData.nodes[nearestId];

  if (selectingPoint === 'start') {
    if (selectedNodes[0] && markers[0]) map.removeLayer(markers[0]);
    selectedNodes[0] = nearestId;
    const marker = L.marker([coords.lat, coords.lng], { icon: createColoredIcon('green') })
      .addTo(map).bindPopup("🟢 Başlangıç").openPopup();
    markers[0] = marker;
    startInput.value = `Seçilen konum: ${nearestId.substring(0, 15)}...`;
    document.getElementById("startMapBtn").classList.remove("active");
  } else if (selectingPoint === 'end') {
    const lastIndex = selectedNodes.length > 0 ? selectedNodes.length - 1 : 1;
    if (markers[lastIndex]) map.removeLayer(markers[lastIndex]);
    selectedNodes[lastIndex] = nearestId;
    const marker = L.marker([coords.lat, coords.lng], { icon: createColoredIcon('red') })
      .addTo(map).bindPopup("🔴 Bitiş").openPopup();
    markers[lastIndex] = marker;
    endInput.value = `Seçilen konum: ${nearestId.substring(0, 15)}...`;
    document.getElementById("endMapBtn").classList.remove("active");
  }

  selectingPoint = null;
  updateMapCursor(false);

  if (selectedNodes.filter(n => n).length >= 2) {
    setTimeout(() => calculateRoute(), 500);
  }
});

function updateUI() {
  if (selectedNodes.length >= 1) {
    startInput.value = `Başlangıç: ${selectedNodes[0].substring(0, 15)}...`;
  }
  if (selectedNodes.length >= 2) {
    endInput.value = `Bitiş: ${selectedNodes[selectedNodes.length - 1].substring(0, 15)}...`;
  }
  updateStopList();
}

document.querySelectorAll('.mode-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    currentMode = card.dataset.mode;
    if (selectedNodes.filter(n => n).length >= 2) updateTravelTimes();
  });
});

function updateTravelTimes() {
  const totalDist = parseFloat(document.getElementById("distance").innerText) || 0;
  Object.keys(speedModes).forEach(mode => {
    const time = (totalDist / speedModes[mode]) * 60;
    document.getElementById(`${mode}-time`).innerText = `${Math.round(time)} dk`;
  });
}

// GERÇEK YOL ROTASI ÇİZİMİ
// main.js içindeki calculateRoute fonksiyonunu SİL ve bunu YAPIŞTIR:

// main.js içindeki calculateRoute fonksiyonunun TAMAMI:

function calculateRoute() {
  // 1. Geçerli node'ları al (boş olanları temizle)
  let validNodes = selectedNodes.filter(n => n);

  if (!graphData || validNodes.length < 2) {
    alert("⚠️ En az 2 nokta seçin!");
    return;
  }

  // --- [YENİ BÖLÜM] TSP OPTİMİZASYONU BAŞLANGICI ---
  // Eğer 2'den fazla nokta varsa optimize et
  if (validNodes.length > 2) {
    console.log("🧮 Duraklar optimize ediliyor (TSP)...");
    
    // tsp.js'den gelen fonksiyonu çalıştır
    if (typeof optimizeRoute === 'function') {
        const optimizedNodes = optimizeRoute(graphData, validNodes);
        
        // Eğer sıralama değiştiyse güncelle
        if (optimizedNodes && optimizedNodes.length === validNodes.length) {
            console.log("Eski Sıra:", validNodes);
            console.log("Yeni Sıra:", optimizedNodes);
            
            validNodes = optimizedNodes;
            selectedNodes = validNodes; // Global listeyi güncelle
            updateUI(); // Ekranda da değişsin
        }
    } else {
        console.warn("⚠️ optimizeRoute fonksiyonu bulunamadı! tsp.js import edildi mi?");
    }
  }
  // --- TSP OPTİMİZASYONU BİTİŞİ ---

  console.log(`\n🚀 ROTA HESAPLANIYOR...`);

  // Haritadaki eski çizgileri temizle
  routeLines.forEach(l => map.removeLayer(l));
  routeLines = [];

  const traffic = document.getElementById("traffic") ? document.getElementById("traffic").value : 'normal';
  let totalDistance = 0;
  let allPathCoords = [];

  // 2. Her durak arası için döngü (Segment Segment çizim)
  for (let i = 0; i < validNodes.length - 1; i++) {
    const start = String(validNodes[i]);
    const end = String(validNodes[i + 1]);

    // Dijkstra ile yolu bul
    const res = dijkstra(graphData, start, end, traffic);

    if (!res?.path?.length) {
      alert(`❌ Rota bulunamadı: Segment ${i + 1} (${start} -> ${end})`);
      return;
    }

    // --- [GEOMETRY BÖLÜMÜ] Kıvrımlı Yollar ---
    let segmentCoords = [];

    for (let j = 0; j < res.path.length - 1; j++) {
      const currentNodeId = String(res.path[j]);
      const nextNodeId = String(res.path[j + 1]);

      const currentNode = graphData.nodes[currentNodeId];
      if (!currentNode) continue;

      // Bu node'dan çıkan bağlantıları (edges) kontrol et
      const edges = graphData.edges[currentNodeId];
      if (edges) {
        const edge = edges.find(e => String(e.node) === nextNodeId);

        // Eğer geometry (kıvrım) verisi varsa onu kullan
        if (edge && edge.geometry && Array.isArray(edge.geometry) && edge.geometry.length > 0) {
          edge.geometry.forEach(pt => {
            segmentCoords.push(pt);
          });
        } else {
          // Yoksa mecburen düz çizgi için nokta koordinatını al
          segmentCoords.push([currentNode.lat, currentNode.lng]);
        }
      }
    }

    // Son noktayı ekle
    const lastNodeId = res.path[res.path.length - 1];
    const lastNode = graphData.nodes[lastNodeId];
    if (lastNode) {
      segmentCoords.push([lastNode.lat, lastNode.lng]);
    }

    allPathCoords.push(...segmentCoords);

    // Çizgi Rengi ve Stili
    const colors = ['#2563eb', '#7c3aed', '#059669', '#dc2626', '#f59e0b'];
    const color = colors[i % colors.length];

    const polyline = L.polyline(segmentCoords, {
      color: color,
      weight: 6,
      opacity: 0.8,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);

    routeLines.push(polyline);
    totalDistance += res.distance;
  }

  // 3. Haritayı sığdır ve Bilgileri Güncelle
  if (allPathCoords.length > 0) {
    const bounds = L.latLngBounds(allPathCoords);
    map.fitBounds(bounds, { padding: [50, 50] });
  }

  const totalKm = (totalDistance / 1000).toFixed(2);
  
  const distEl = document.getElementById("distance");
  if(distEl) distEl.innerText = `${totalKm} km`;

  // Ortalama hız (Varsayılan 50 km/s)
  const speed = (speedModes && speedModes[currentMode]) ? speedModes[currentMode] : 50;
  const totalTime = Math.round((parseFloat(totalKm) / speed) * 60);
  
  const durEl = document.getElementById("duration");
  if(durEl) durEl.innerText = `${totalTime} dk`;

  // Yan paneldeki süreleri güncelle
  if (typeof updateTravelTimes === 'function') updateTravelTimes();
  
  // Yol tarifini güncelle
  if (typeof generateDirections === 'function') generateDirections(allPathCoords);

  console.log(`✅ ROTA TAMAMLANDI: ${totalKm} km`);
}

function generateDirections(pathCoords) {
  const directions = [];
  for (let i = 0; i < pathCoords.length - 1; i++) {
    const [lat1, lng1] = pathCoords[i];
    const [lat2, lng2] = pathCoords[i + 1];
    const dist = calculateDistance(lat1, lng1, lat2, lng2);
    const bearing = calculateBearing(lat1, lng1, lat2, lng2);
    const direction = getDirection(bearing);

    if (i === 0) directions.push({ instruction: `${direction} ilerleyin`, distance: dist });
    else if (i % 10 === 0) directions.push({ instruction: `${direction} devam edin`, distance: dist });
  }
  directions.push({ instruction: "🎯 Hedefinize ulaştınız!", distance: 0 });

  document.getElementById("directions").innerHTML = directions.map((dir, i) => `
    <div class="dirStep">
      <strong>${i + 1}.</strong> ${dir.instruction}
      ${dir.distance > 0 ? `<small>(~${Math.round(dir.distance)}m)</small>` : ''}
    </div>
  `).join("");
}

document.getElementById("calcBtn").addEventListener("click", () => calculateRoute());

document.getElementById("clearBtn").addEventListener("click", () => {
  selectedNodes = [];
  markers.forEach(m => map.removeLayer(m));
  routeLines.forEach(l => map.removeLayer(l));
  markers = []; routeLines = [];
  startInput.value = ""; endInput.value = "";
  document.getElementById("distance").innerText = "0 km";
  document.getElementById("duration").innerText = "0 dk";
  document.getElementById("directions").innerHTML = '<div class="dirStep">Rota hesaplanınca adımlar burada görünecek.</div>';
  ["car", "bike", "walk"].forEach(m => document.getElementById(`${m}-time`).innerText = "-- dk");
  selectingPoint = null; updateMapCursor(false);
  document.getElementById("startMapBtn").classList.remove("active");
  document.getElementById("endMapBtn").classList.remove("active");
  map.setView([37.215, 28.365], 13);
});

function updateStopList() {
  const list = document.getElementById("stop-list");
  if (!list) return; // 🔧 KRİTİK KORUMA

  list.innerHTML = "";


  // Başlangıç ve bitiş HARİÇ, aradakiler durak
  selectedNodes.slice(1, -1).forEach((nodeId, index) => {
    const div = document.createElement("div");
    div.className = "stop-item";
    div.innerHTML = `
      <span>Durak ${index + 1}</span>
      <button onclick="removeStop(${index + 1})">🗑</button>
    `;
    list.appendChild(div);
  });
}

window.removeStop = function(index) {
  // index: selectedNodes içindeki gerçek index
  if (markers[index]) map.removeLayer(markers[index]);

  selectedNodes.splice(index, 1);
  markers.splice(index, 1);

  updateStopList();

  if (selectedNodes.length >= 2) {
    calculateRoute();
  }
};

let stopIndex = 0;

function createStopInput() {
  stopIndex++;

  const row = document.createElement("div");
  row.className = "row stop-row";

  row.innerHTML = `
    <div class="field">
      <label>Durak ${stopIndex}</label>
      <div class="location-input-group">
        <div class="input-wrapper">
          <input
            type="text"
            placeholder="Adres yazın (ör: Ara Durak)..."
            autocomplete="off"
            class="stop-input"
          />
          <div class="autocomplete-dropdown"></div>
        </div>

        <button class="map-select-btn stopMapBtn">
          📍 Haritadan Seç
        </button>
      </div>
    </div>
  `;

  // ÖNCE DOM'a ekle
  document.getElementById("stop-list").appendChild(row);

  // SONRA event listener'ları ekle
  const input = row.querySelector(".stop-input");
  const dropdown = row.querySelector(".autocomplete-dropdown");
  const mapBtn = row.querySelector(".stopMapBtn");

  // Adres otomatik tamamlama ekle
  input.addEventListener("input", (e) => handleAddressInput(e.target.value, "stop", dropdown, row));

  // Haritadan seç butonu - DÜZELTME
  mapBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log("🔵 Durak haritadan seç butonuna tıklandı");
    
    selectingPoint = "stop";
    updateMapCursor(true);
    
    // Tüm butonlardan active sınıfını kaldır
    document.querySelectorAll(".map-select-btn").forEach(btn => btn.classList.remove("active"));
    mapBtn.classList.add("active");
    
    // Bu durak için referans tut
    window.currentStopElement = row;
  });

  return row;
}

function selectStopFromAutocomplete(lat, lng, name, stopEl) {
  const nearestId = findNearestNode(lat, lng);
  if (!nearestId) return;

  const index =
    Array.from(document.querySelectorAll(".stop-row")).indexOf(stopEl) + 1;

  selectedNodes[index] = nearestId;

  const coords = graphData.nodes[nearestId];
  
  const color = routeColors[(index - 1) % routeColors.length];

const marker = L.marker([coords.lat, coords.lng], {
  icon: createColoredCircleIcon(color)
}).addTo(map);

marker.bindPopup(`
  <div style="display:flex;align-items:center;gap:6px">
    <strong>Durak ${index}</strong>
    <button
      onclick="removeStop(${index})"
      style="
        border:none;
        background:#ef4444;
        color:white;
        border-radius:4px;
        padding:2px 6px;
        cursor:pointer;
      "
    >✕</button>
  </div>
`);


  markers[index] = marker;
  stopEl.querySelector("input").value = name;

  calculateRoute();
}

const autocompleteConfigs = [
  {
    inputId: "startInput",
    dropdownId: "start-autocomplete",
    type: "start"
  },
  {
    inputId: "stopInput",
    dropdownId: "stop-autocomplete",
    type: "stop"
  },
  {
    inputId: "endInput",
    dropdownId: "end-autocomplete",
    type: "end"
  }
];

const selectedLocations = {
  start: null,
  stop: null,
  end: null
};

autocompleteConfigs.forEach(config => {
  setupAutocomplete(config);
});

function setupAutocomplete({ inputId, dropdownId, type }) {
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);

  let activeIndex = -1;
  let results = [];

  input.addEventListener("input", async () => {
    const query = input.value.trim();
    dropdown.innerHTML = "";
    dropdown.classList.remove("show");
    activeIndex = -1;

    if (query.length < 3) return;

    dropdown.classList.add("show");
    dropdown.innerHTML = `<div class="autocomplete-loading">Aranıyor...</div>`;

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${query}&countrycodes=tr&limit=5`
      );
      results = await res.json();

      dropdown.innerHTML = "";

      results.forEach((item, index) => {
        const div = document.createElement("div");
        div.className = "autocomplete-item";
        div.textContent = item.display_name;

        div.addEventListener("click", () => {
          selectItem(item);
        });

        dropdown.appendChild(div);
      });

    } catch (err) {
      dropdown.innerHTML = `<div class="autocomplete-loading">Hata oluştu</div>`;
    }
  });

  input.addEventListener("keydown", e => {
    const items = dropdown.querySelectorAll(".autocomplete-item");
    if (!items.length) return;

    if (e.key === "ArrowDown") {
      activeIndex = (activeIndex + 1) % items.length;
    } else if (e.key === "ArrowUp") {
      activeIndex = (activeIndex - 1 + items.length) % items.length;
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0) selectItem(results[activeIndex]);
    }

    items.forEach((item, i) =>
      item.classList.toggle("active", i === activeIndex)
    );
  });

  document.addEventListener("click", e => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove("show");
    }
  });

  function selectItem(item) {
    input.value = item.display_name;
    dropdown.classList.remove("show");

    const latlng = [parseFloat(item.lat), parseFloat(item.lon)];
    selectedLocations[type] = latlng;

    addMarker(latlng, type);
  }
}

