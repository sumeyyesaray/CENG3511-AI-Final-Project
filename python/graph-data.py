import osmnx as ox
import networkx as nx
import json

def generate_hybrid_graph():
    # 1. Menteşe için detaylı veri (Tüm yollar)
    print("Menteşe detaylı verileri indiriliyor...")
    mentese_graph = ox.graph_from_place("Menteşe, Muğla, Turkey", network_type='drive')
    
    # 2. Muğla geneli için sadece ana yollar (Primary, secondary, tertiary)
    print("Muğla ana yolları indiriliyor...")
    mugla_graph = ox.graph_from_place("Muğla, Turkey", network_type='drive', 
                                      custom_filter='["highway"~"primary|secondary|tertiary"]')

    # Grafikleri birleştirme
    combined_graph = nx.compose(mentese_graph, mugla_graph)
    
    nodes_data = {}
    edges_data = {}
    
    # Koordinatları ve Düğümleri Hazırlama
    for node, data in combined_graph.nodes(data=True):
        nodes_data[node] = [data['y'], data['x']]
    
    # Kenarları (Edges) ve Trafik Ağırlıklarını Hazırlama
    for u, v, data in combined_graph.edges(data=True):
        if u not in edges_data:
            edges_data[u] = []
        
        # Ağırlık olarak mesafe (length) kullanılıyor, trafik simülasyonu eklenebilir
        weight = data.get('length', 1)
        edges_data[u].append({"node": str(v), "weight": weight})

    # JSON formatına kaydet
    full_data = {
        "nodes": list(nodes_data.keys()),
        "coordinates": nodes_data,
        "edges": edges_data
    }
    
    with open('graph-data.json', 'w') as f:
        json.dump(full_data, f)
    print("graph-data.json başarıyla oluşturuldu.")

if __name__ == "__main__":
    generate_hybrid_graph()