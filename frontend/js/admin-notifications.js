// js/admin-notifications.js
const API_BASE = 'http://localhost:5002/api';

async function loadAdminNotifications() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const res = await fetch(`${API_BASE}/notifications`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;
        const notifications = await res.json();
        
        // Фільтруємо лише непрочитані
        const unread = notifications.filter(n => !n.isRead);
        
        const badge = document.getElementById('adminNotifBadge');
        const list = document.getElementById('adminNotifList');

        // Оновлюємо бейдж
        if (badge) {
            if (unread.length > 0) {
                badge.textContent = unread.length;
                badge.classList.remove('d-none');
            } else {
                badge.classList.add('d-none');
            }
        }

        // Рендеримо список
        if (list) {
            if (notifications.length === 0) {
                list.innerHTML = '<li><div class="dropdown-item text-center text-muted small py-4">Немає критичних подій</div></li>';
                return;
            }

            list.innerHTML = notifications.map(n => `
                <li>
                    <a href="${n.link || '#'}" onclick="markAsRead('${n._id}', event, '${n.link}')" 
                       class="dropdown-item text-wrap py-3 border-bottom ${n.isRead ? 'bg-white' : 'bg-danger bg-opacity-10'}">
                        <div class="d-flex align-items-start">
                            <i class="bi bi-exclamation-triangle-fill text-danger fs-5 me-3 mt-1"></i>
                            <div>
                                <h6 class="mb-1 fw-bold text-dark" style="font-size: 0.9rem;">${n.title}</h6>
                                <small class="text-muted d-block" style="font-size: 0.8rem; white-space: normal;">${n.message}</small>
                                <small class="text-secondary mt-1 d-block" style="font-size: 0.7rem;">
                                    ${new Date(n.createdAt).toLocaleString('uk-UA')}
                                </small>
                            </div>
                        </div>
                    </a>
                </li>
            `).join('');
        }
    } catch (error) {
        console.error("Помилка завантаження сповіщень адміна:", error);
    }
}

window.markAsRead = async function(id, event, link) {
    // 1. ЗАВЖДИ зупиняємо стандартний перехід по лінку браузером!
    event.preventDefault(); 

    try {
        const token = localStorage.getItem('token');
        
        // 2. Спочатку ЧЕКАЄМО завершення запиту до бази
        await fetch(`${API_BASE}/notifications/read/${id}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        // 3. А тепер безпечно переходимо на потрібну сторінку за допомогою JS
        if (link && link !== 'null' && link !== '#') {
            window.location.href = link;
        } else {
            loadAdminNotifications(); // Якщо лінка нема, просто оновлюємо бейдж
        }
    } catch (e) { 
        console.error("Помилка відмітки сповіщення:", e);
        // Якщо сервер трохи "затупив", все одно пускаємо адміна до тікета
        if (link && link !== 'null' && link !== '#') {
            window.location.href = link;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // 1. Спочатку просто завантажуємо список при відкритті сторінки
    loadAdminNotifications();
    
    // 2. Налаштовуємо Сокети для автоматичного оновлення
    if (typeof io !== 'undefined') {
        const socket = io('http://localhost:5002'); // Твій бекенд
        
        // НАДІЙНО дістаємо ID адміна (перевіряємо обидва варіанти збереження)
        let adminId = localStorage.getItem('userId');
        if (!adminId || adminId === "null") {
            const userData = localStorage.getItem('user');
            if (userData) {
                try { adminId = JSON.parse(userData)._id || JSON.parse(userData).id; } catch (e) {}
            }
        }

        if (adminId) {
            // Приєднуємо адміна до його персональної socket-кімнати
            socket.emit('join', adminId);
            console.log("🟢 Admin Socket успішно підключено. ID:", adminId);

            // Слухаємо подію нового сповіщення
            socket.on('new_notification', (data) => {
                console.log("🔔 [SOCKET] Отримано нове сповіщення:", data);
                
                // Просто викликаємо функцію завантаження ще раз! 
                // Вона сама перемалює список і збільшить циферку на бейджі.
                loadAdminNotifications(); 
            });
        } else {
            console.error("🔴 Admin ID не знайдено в localStorage. Сокет не підключено.");
        }
    } else {
        console.error("🔴 Бібліотека Socket.IO не підключена в HTML файлі!");
    }
});