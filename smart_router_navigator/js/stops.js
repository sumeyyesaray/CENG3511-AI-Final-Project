// stops.js artık main.js'te yönetiliyor
// Bu dosya sadece import hatası vermesin diye boş

export const stops = [];

export function addStop(stop) {
    console.log("addStop() artık main.js'te");
}

export function removeStop(index) {
    console.log("removeStop() artık main.js'te");
}