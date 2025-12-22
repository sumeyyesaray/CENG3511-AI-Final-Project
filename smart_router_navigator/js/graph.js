export let graph = {
    nodes: new Map(),
    adj: new Map()
};

// YEDEK: Eğer graph-data.json yoksa/bozuksa kullan
function createDefaultGraph() {
    console.log("⚠️ Varsayılan graph oluşturuluyor...");

    // Muğla merkez etrafında grid oluştur
    const centerLat = 37.2153;
    const centerLon = 28.3636;
    const gridSize = 20; // 20x20 grid
    const spacing = 0.002; // ~200m aralıklar

    let nodeId = 1;
    const nodePositions = new Map();

    // Grid node'ları oluştur
    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            const lat = centerLat + (i - gridSize / 2) * spacing;
            const lon = centerLon + (j - gridSize / 2) * spacing;

            const id = String(nodeId++);
            graph.nodes.set(id, { lat, lon });
            graph.adj.set(id, []);
            nodePositions.set(`${i},${j}`, id);
        }
    }

    // Edge'leri oluştur (komşu node'ları bağla)
    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            const currentId = nodePositions.get(`${i},${j}`);
            const current = graph.nodes.get(currentId);

            // Sağ komşu
            if (j < gridSize - 1) {
                const rightId = nodePositions.get(`${i},${j + 1}`);
                const right = graph.nodes.get(rightId);
                const dist = haversine(current.lat, current.lon, right.lat, right.lon);

                graph.adj.get(currentId).push({
                    to: rightId,
                    w: dist,
                    geom: [[current.lat, current.lon], [right.lat, right.lon]]
                });

                graph.adj.get(rightId).push({
                    to: currentId,
                    w: dist,
                    geom: [[right.lat, right.lon], [current.lat, current.lon]]
                });
            }

            // Alt komşu
            if (i < gridSize - 1) {
                const downId = nodePositions.get(`${i + 1},${j}`);
                const down = graph.nodes.get(downId);
                const dist = haversine(current.lat, current.lon, down.lat, down.lon);

                graph.adj.get(currentId).push({
                    to: downId,
                    w: dist,
                    geom: [[current.lat, current.lon], [down.lat, down.lon]]
                });

                graph.adj.get(downId).push({
                    to: currentId,
                    w: dist,
                    geom: [[down.lat, down.lon], [current.lat, current.lon]]
                });
            }

            // Çapraz bağlantılar (bazı node'lar için)
            if (i < gridSize - 1 && j < gridSize - 1 && (i + j) % 3 === 0) {
                const diagId = nodePositions.get(`${i + 1},${j + 1}`);
                const diag = graph.nodes.get(diagId);
                const dist = haversine(current.lat, current.lon, diag.lat, diag.lon);

                graph.adj.get(currentId).push({
                    to: diagId,
                    w: dist,
                    geom: [[current.lat, current.lon], [diag.lat, diag.lon]]
                });

                graph.adj.get(diagId).push({
                    to: currentId,
                    w: dist,
                    geom: [[diag.lat, diag.lon], [current.lat, current.lon]]
                });
            }
        }
    }

    console.log(`✅ Varsayılan graph oluşturuldu: ${graph.nodes.size} node`);
}

export async function loadGraph() {
    try {
        console.log("📂 Graph yükleniyor...");

        const res = await fetch("data/graph-data.json");

        if (!res.ok) {
            console.warn(`⚠️ graph-data.json bulunamadı (${res.status})`);
            createDefaultGraph();
            return;
        }

        const data = await res.json();
        console.log("📦 JSON yüklendi");

        // Nodes kontrolü
        if (!data.nodes || typeof data.nodes !== 'object') {
            console.error("❌ Geçersiz JSON formatı!");
            createDefaultGraph();
            return;
        }

        // Nodes kontrolü ve yükleme
        // data.nodes can be either an object {id: {lat,lon}} or an array of IDs.
        if (Array.isArray(data.nodes)) {
            // Generate placeholder coordinates on a simple grid (≈100 m spacing)
            const spacing = 0.001; // ~100 m
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
        } else if (data.nodes && typeof data.nodes === "object") {
            for (const [id, n] of Object.entries(data.nodes)) {
                if (n && typeof n.lat === "number" && typeof n.lon === "number") {
                    graph.nodes.set(id, { lat: n.lat, lon: n.lon });
                    graph.adj.set(id, []);
                }
            }
        }

        console.log(`✅ ${graph.nodes.size} node yüklendi`);

        // Edges kontrolü
        let edges = [];

        if (Array.isArray(data.edges)) {
            edges = data.edges;
        } else if (data.edges && typeof data.edges === 'object') {
            edges = Object.values(data.edges);
        } else {
            console.warn("⚠️ Edge bulunamadı");
        }

        console.log(`📊 ${edges.length} edge işleniyor...`);

        // Edges'leri yükle
        let loadedEdges = 0;
        for (const e of edges) {
            if (!e.u || !e.v) continue;
            if (!graph.nodes.has(e.u) || !graph.nodes.has(e.v)) continue;

            const n1 = graph.nodes.get(e.u);
            const n2 = graph.nodes.get(e.v);

            const geometry = e.geometry || [[n1.lat, n1.lon], [n2.lat, n2.lon]];
            const length = e.length || haversine(n1.lat, n1.lon, n2.lat, n2.lon);

            graph.adj.get(e.u).push({
                to: e.v,
                w: length,
                geom: geometry
            });

            graph.adj.get(e.v).push({
                to: e.u,
                w: length,
                geom: geometry.slice().reverse()
            });

            loadedEdges++;
        }

        console.log(`✅ ${loadedEdges} edge yüklendi`);

        // Graph geçerliliğini kontrol et
        if (graph.nodes.size === 0) {
            console.error("❌ Hiç node yüklenemedi!");
            createDefaultGraph();
            return;
        }

        // İstatistikler
        const avgDegree = (loadedEdges * 2 / graph.nodes.size).toFixed(1);
        console.log(`📊 Graph İstatistikleri:`);
        console.log(`   • Nodes: ${graph.nodes.size}`);
        console.log(`   • Edges: ${loadedEdges}`);
        console.log(`   • Ortalama derece: ${avgDegree}`);

        // İlk 3 node'u göster
        const sample = Array.from(graph.nodes.entries()).slice(0, 3);
        console.log(`   • Örnek nodes:`, sample);

    } catch (error) {
        console.error("❌ Graph yükleme hatası:", error);
        console.log("🔄 Varsayılan graph oluşturuluyor...");
        createDefaultGraph();
    }
}

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = x => x * Math.PI / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}