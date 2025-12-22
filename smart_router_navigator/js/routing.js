import { graph } from "./graph.js";

export function dijkstra(start, end, trafficFn) {
    const dist = new Map();
    const prev = new Map();
    const pq = [];

    for (const id of graph.nodes.keys()) dist.set(id, Infinity);
    dist.set(start, 0);
    pq.push({ id: start, d: 0 });

    while (pq.length) {
        pq.sort((a, b) => a.d - b.d);
        const { id } = pq.shift();

        if (id === end) break;

        for (const e of graph.adj.get(id)) {
            const traffic = trafficFn ? trafficFn(id, e.to) : 1;
            const nd = dist.get(id) + e.w * traffic;
            if (nd < dist.get(e.to)) {
                dist.set(e.to, nd);
                prev.set(e.to, id);
                pq.push({ id: e.to, d: nd });
            }
        }
    }

    const path = [];
    let cur = end;
    while (cur) {
        path.push(cur);
        cur = prev.get(cur);
    }

    return path.reverse();
}
