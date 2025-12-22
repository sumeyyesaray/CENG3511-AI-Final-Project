// traffic.js
export function getTrafficWeight() {
    // Rastgele trafik ağırlığı (1.0 - 2.0 arası)
    const base = 1.0;
    const random = Math.random() * 0.5 + 0.5; // 0.5 - 1.0

    // Saate göre trafik artışı (sabah/akşam yoğunluğu)
    const now = new Date();
    const hour = now.getHours();
    let hourFactor = 1.0;

    if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
        hourFactor = 1.8; // Yoğun saatler
    } else if (hour >= 20 || hour <= 6) {
        hourFactor = 1.1; // Gece
    }

    return base + random * hourFactor;
}

export function getTrafficColor(weight) {
    if (weight < 1.3) return "green";
    if (weight < 1.7) return "orange";
    return "red";
}