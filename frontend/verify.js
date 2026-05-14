// Отримуємо токен із URL
const params = new URLSearchParams(window.location.search);
const token = params.get('token');

const verifyMessage = document.getElementById('verifyMessage');
const backBtn = document.getElementById('backBtn');

if (!token) {
  verifyMessage.textContent = "Токен не знайдено.";
  verifyMessage.className = "text-danger";
  backBtn.style.display = "block";
} 
