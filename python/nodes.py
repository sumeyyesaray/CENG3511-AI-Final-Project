import osmnx as ox
import json
import networkx as nx

# 1. AYARLAR: Sadece Menteşe İlçesi
# OSMnx yer ismini tanır ve sadece bu poligonun içini indirir.
place_name = "Menteşe, Muğla, Turkey"

print(f"'{place_name}' sınırları içindeki yol ağı indiriliyor...")

# 'drive' = Sadece araç yolları (yürüyüş yolları hariç, navigasyon için ideal)
# simplify=True -> Gereksiz ara noktaları temizler ama virajları korur.
G = ox.graph_from_place(place_name, network_type='drive', simplify=True)

print(f"✅ İndirildi! Toplam {len(G.nodes)} kavşak ve {len(G.edges)} yol parçası işleniyor...")

# 2. Veriyi JS formatına çevirmek için hazırlık
nodes = {}
edges = {}

# --- NODE (DÜĞÜM) İŞLEME ---
for node_id, data in G.nodes(data=True):
    nodes[str(node_id)] = {
        "lat": data['y'],  # Enlem
        "lng": data['x']   # Boylam
    }

# --- EDGE (YOL) VE GEOMETRİ İŞLEME ---
for u, v, k, data in G.edges(keys=True, data=True):
    u_str = str(u) # Başlangıç Node ID
    v_str = str(v) # Bitiş Node ID
    
    if u_str not in edges:
        edges[u_str] = []
        
    # KIYMETLİ KISIM: Geometri (Kıvrımlar)
    # OSMnx geometriyi (lon, lat) olarak verir, Leaflet (lat, lon) ister.
    # Bu yüzden yerlerini değiştiriyoruz: [pt[1], pt[0]]
    geometry_coords = []
    if 'geometry' in data:
        geometry_coords = [[pt[1], pt[0]] for pt in data['geometry'].coords]
    
    # Yol verisini oluştur
    edge_data = {
        "id": v_str,                     # Hedef Node ID
        "weight": data.get('length', 0), # Yol uzunluğu (metre)
        "name": data.get('name', ''),    # Yol ismi (Atatürk Bulvarı vb.)
        "geometry": geometry_coords      # Kıvrım noktaları
    }
    
    # Listeye ekle
    edges[u_str].append(edge_data)

# 3. JSON OLARAK KAYDETME
output = {"nodes": nodes, "edges": edges}

file_name = "graph-data-mentese.json"
with open(file_name, "w", encoding="utf-8") as f:
    json.dump(output, f, ensure_ascii=False)

print(f"🎉 İşlem Tamam! '{file_name}' dosyası oluşturuldu.")
print("Bu dosyayı projendeki 'graph-data.json' ile değiştirip kullanabilirsin.")