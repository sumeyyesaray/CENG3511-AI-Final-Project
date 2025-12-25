export function dijkstra(graph, startNode, endNode) {
  /* veri yapıları */
  const dist = {};
  const prev = {};
  const visited = new Set();
  const pq = [];

  /* tüm nodelar için başlangıç değerleri atıyoruz.*/
  for (const id in graph.nodes) {
    dist[id] = Infinity; /*başlangıçta tüm değerler sonsuz aralıkta */
    prev[id] = null; /* hiçbir node un önceki node u yok */
  }

  dist[startNode] = 0;

  pq.push({ id: startNode, d: 0 });

  /*graphı tarama kısmı : queue i mesafeye göre sıralar (normalde min hap kullanılıyomuş)
  burda array sort kullanıyoz */
  while (pq.length) {
    pq.sort((a, b) => a.d - b.d);
    const { id } = pq.shift(); // en kısa node u kuyruktan çıkar.

    if (visited.has(id)) continue; // node daha önce eklendiyse devam et
    visited.add(id); // ziyaret edildi işareti

    if (id === endNode) break; //rota bittiyse döngüyü bitir.

    // koşulları incele:

    const edges = graph.edges[id] || []; //node un komşularını alır
    for (const e of edges) {
      const to = e.node;
      const w = e.weight;

      if (!graph.nodes[to]) continue; //komşu yoksa atla (hata çıkmasın diye)

      const alt = dist[id] + w; //alternatif mesafe
      if (alt < dist[to]) {
        dist[to] = alt;
        prev[to] = id;
        pq.push({ id: to, d: alt });
      }
    }
  }

  //sonuçları kontrol eder
  if (dist[endNode] === Infinity) return null;

  const path = []; //rota
  let u = endNode; //hedef
  while (u) {
    path.unshift(u);
    u = prev[u];
  }

  return { path, distance: dist[endNode] };
}
