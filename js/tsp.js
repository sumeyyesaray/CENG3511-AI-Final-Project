// tsp.js
import { dijkstra } from "./dijkstra.js";

/**
 * Gezgin Satıcı Problemi (TSP) Çözücü - Brute Force Yöntemi
 * Başlangıç noktası sabit kalır, diğerlerini en kısa yol için sıralar.
 * birden fazla durak eklendiğinde optimizasyon sağlamak için kullanıyoruz.
 */
export function optimizeRoute(graph, nodes) {
  // Eğer durak sayısı 3'ten azsa sıralamaya gerek yok (Başlangıç -> Bitiş)
  if (nodes.length < 3) return nodes;
  if (nodes.length > 9) {
    alert("⚠️ Çok fazla durak var! Optimizasyon uzun sürebilir.");
  }

  const startNode = nodes[0]; // Başlangıç noktası sabit (kullanıcının konumu)
  const otherNodes = nodes.slice(1); // Sıralanacak diğer duraklar

  // 1. ADIM: Mesafe Matrisini Oluştur
  // Tüm seçili noktalar arasındaki mesafeleri önceden hesapla
  // Bu, her permütasyonda tekrar tekrar Dijkstra çalıştırmamak için gereklidir.
  const distMatrix = {};
  
  // Matrisi hazırla
  nodes.forEach(id1 => {
    distMatrix[id1] = {};
    nodes.forEach(id2 => {
      if (id1 === id2) {
        distMatrix[id1][id2] = 0;
      } else {
        // İki nokta arasındaki mesafeyi bul
        // Not: Bu kısım biraz maliyetlidir ama gereklidir.
        const pathData = dijkstra(graph, String(id1), String(id2));
        distMatrix[id1][id2] = pathData ? pathData.distance : Infinity;
      }
    });
  });

  // 2. ADIM: Tüm Permütasyonları (Olasılıkları) Oluştur
  const permutations = getPermutations(otherNodes);
  
  let minDistance = Infinity;
  let bestOrder = [];

  // 3. ADIM: En Kısa Yolu Bul
  permutations.forEach(perm => {
    // Rotayı oluştur: Başlangıç -> P1 -> P2 -> ... -> Pn
    const currentRoute = [startNode, ...perm];
    
    // Bu sıradaki toplam mesafeyi hesapla
    let currentDist = 0;
    let valid = true;

    for (let i = 0; i < currentRoute.length - 1; i++) {
      const u = currentRoute[i];
      const v = currentRoute[i+1];
      const d = distMatrix[u][v];
      
      if (d === Infinity) {
        valid = false;
        break; 
      }
      currentDist += d;
    }

    // Eğer bu rota geçerliyse ve şu ana kadarki en kısaysa, kaydet
    if (valid && currentDist < minDistance) {
      minDistance = currentDist;
      bestOrder = currentRoute;
    }
  });

  console.log(`🎯 TSP Optimize Edildi! Eski Mesafe yerine En Kısa Mesafe: ${Math.round(minDistance)}m`);
  return bestOrder;
}

// Yardımcı Fonksiyon: Permütasyon Üretici (Recursive)
function getPermutations(arr) {
  if (arr.length === 0) return [[]];
  const firstEl = arr[0];
  const rest = arr.slice(1);
  const permsWithoutFirst = getPermutations(rest);
  const allPermutations = [];

  permsWithoutFirst.forEach((perm) => {
    for (let i = 0; i <= perm.length; i++) {
      const permWithFirst = [...perm.slice(0, i), firstEl, ...perm.slice(i)];
      allPermutations.push(permWithFirst);
    }
  });
  return allPermutations;
}