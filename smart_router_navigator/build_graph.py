import osmnx as ox
import networkx as nx
import json


def generate_hybrid_graph():
    print("🚀 İşlem Başlıyor: Hibrit Harita Oluşturuluyor...")

    # --- 1. AŞAMA: Menteşe (DETAYLI) ---
    print("1/3 Menteşe ilçesi detaylı olarak indiriliyor (Tüm sokaklar)...")
    # Menteşe için tüm sürüş yollarını alıyoruz
    G_mentese = ox.graph_from_place("Menteşe, Muğla, Turkey", network_type='drive')
    print(f"   ✅ Menteşe indirildi: {len(G_mentese.nodes)} düğüm.")

    # --- 2. AŞAMA: Tüm Muğla (SADECE ANA YOLLAR) ---
    print("2/3 Tüm Muğla ili ana yolları indiriliyor (Filtreli)...")
    # Sadece otoban, şehirlerarası ve ana caddeleri alıyoruz.
    # 'tertiary' (üçüncil) yolları da ekledim ki bağlantı kopukluğu olmasın.
    custom_filter = '["highway"~"motorway|trunk|primary|secondary|tertiary"]'
    G_mugla = ox.graph_from_place("Muğla, Turkey", custom_filter=custom_filter, simplify=True)
    print(f"   ✅ Muğla omurgası indirildi: {len(G_mugla.nodes)} düğüm.")

    # --- 3. AŞAMA: BİRLEŞTİRME (MERGE) ---
    print("3/3 Haritalar birleştiriliyor...")
    # compose fonksiyonu iki grafı birleştirir. Çakışan düğümleri tek düğüm yapar.
    G_combined = nx.compose(G_mentese, G_mugla)

    # --- JSON DÖNÜŞÜMÜ ---
    print("💾 JSON formatına dönüştürülüyor...")
    output_data = {"nodes": [], "edges": {}, "coordinates": {}}

    for node_id, data in G_combined.nodes(data=True):
        str_id = str(node_id)
        output_data["nodes"].append(str_id)
        output_data["coordinates"][str_id] = [data['y'], data['x']]
        output_data["edges"][str_id] = []

    for u, v, data in G_combined.edges(data=True):
        u_str = str(u)
        v_str = str(v)
        weight = data.get('length', 1)

        edge_info = {
            "node": v_str,
            "weight": round(weight, 2)
        }

        # Yol Geometrisini (Kıvrımları) Al
        if 'geometry' in data:
            geo_coords = [[pt[1], pt[0]] for pt in data['geometry'].coords]
            edge_info['geometry'] = geo_coords

        if u_str in output_data["edges"]:
            output_data["edges"][u_str].append(edge_info)

    # Dosyayı kaydet
    file_name = "graph-data.json"
    with open(file_name, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False)

    print(f"🎉 İŞLEM TAMAM! '{file_name}' oluşturuldu.")
    print(f"Toplam Düğüm Sayısı: {len(output_data['nodes'])}")
    print("Not: Bu dosyayı proje klasörüne atmayı unutma!")


if __name__ == "__main__":
    generate_hybrid_graph()