# Navigation & Route Finding Project

This project is a web-based navigation application that allows users to select locations on a map and calculate the shortest route between them based on real road geometry. The system is designed to avoid unrealistic paths and always generate routes that follow existing roads.
<img width="1854" height="876" alt="image" src="https://github.com/user-attachments/assets/ac3e0446-4b1f-42d4-bb46-5bc4379f249e" />
<img width="1848" height="789" alt="image" src="https://github.com/user-attachments/assets/7cf727cf-f5e4-4b8f-ae4b-8518ee2a105c" />



---

## 🚀 Features

- 🗺️ Interactive map interface
- 📍 Location selection by clicking on the map or entering addresses
- 🛣️ Shortest path calculation based on actual road network
- 🧭 Automatic snapping to the nearest road when a point is selected off-road
- ➕ Support for adding intermediate stops (waypoints)
- ❌ Prevents routes from passing through non-road areas
- 🌙 Clean and user-friendly UI (Dark Glass Design)

---

## 🧠 How It Works

1. The road network is modeled as a **graph** consisting of:
   - **Nodes**: Road intersection points with latitude & longitude
   - **Edges**: Roads connecting nodes with distance weights

2. When a user selects a point:
   - The system finds the **nearest road node**
   - That node is used as the start or end point

3. The shortest route is calculated using:
   - **Dijkstra’s Algorithm**

4. The resulting route is drawn on the map by following the real road shape.

---

## 🛠️ Technologies Used

- **HTML5**
- **CSS3**
- **JavaScript (ES6 Modules)**
- **Leaflet.js** (Map rendering)
- **OpenStreetMap data**
- **Live Server** (for local development)

## 📌 Important Notes

- If a selected point is not exactly on a road, it will automatically snap to the nearest road.
- Routes are always generated **only on existing roads**.
- The system does **not** allow unrealistic straight-line paths.

---

## 🎯 Future Improvements

- Multiple route alternatives
- Distance & estimated time calculation
- Mobile responsiveness
- Turn-by-turn navigation instructions

---

## 👩‍💻 Author

**Sümeyye**  
Muğla Sıtkı Koçman University  
Computer Engineering Student

---

## 📜 License

This project is for educational purposes.


