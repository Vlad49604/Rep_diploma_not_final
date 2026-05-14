// js/student-notifications.js

const NOTIF_API_BASE = 'http://localhost:5002/api';
// Ініціалізуємо сокет (якщо він підключений у HTML)
const socket = typeof io !== 'undefined' ? io('http://localhost:5002') : null; 

function getNotifToken() {
    let token = localStorage.getItem('token');
    if (!token || token === "null") {
        const userData = localStorage.getItem('user');
        if (userData) {
            try { token = JSON.parse(userData).token; } catch (e) {}
        }
    }
    return token;
}

function getUserId() {
    let userId = localStorage.getItem('userId');
    if (!userId || userId === "null") {
        const userData = localStorage.getItem('user');
        if (userData) {
            try { userId = JSON.parse(userData)._id || JSON.parse(userData).id; } catch (e) {}
        }
    }
    return userId;
}

window.loadNotifications = async function() {
    const token = getNotifToken();
    if (!token) return [];

    try {
        const res = await fetch(`${NOTIF_API_BASE}/notifications`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return [];
        const notifications = await res.json();
        
        const countRes = await fetch(`${NOTIF_API_BASE}/notifications/unread-count`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const { count } = await countRes.json();

        // Оновлюємо бейдж
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            if (count > 0) {
                badge.textContent = count;
                badge.classList.remove('d-none');
            } else {
                badge.classList.add('d-none');
            }
        }

        // Рендеримо список
        const list = document.getElementById('notificationsList');
        if (!list) return notifications;

        if (notifications.length === 0) {
            list.innerHTML = '<div class="p-4 text-center text-muted small">Немає нових сповіщень</div>';
            return notifications;
        }

        list.innerHTML = notifications.map(n => {
            const iconMap = {
                info: 'text-success',    // Замість синього "i" — зелений дзвоник
                success: 'bi-check-lg text-success',  // Галочка
                warning: 'bi-exclamation-triangle-fill text-warning', 
                error: 'bi-x-lg text-danger'
            };
            const icon = iconMap[n.type] || iconMap['info'];
            const bgClass = n.isRead ? 'bg-white' : 'bg-success bg-opacity-10';

            return `
                <a href="${n.link || '#'}" onclick="handleNotificationClick('${n._id}', '${n.link || ''}', event)" 
                   class="dropdown-item d-flex align-items-center py-3 border-bottom text-wrap ${bgClass}" 
                   style="white-space: normal; transition: background-color 0.2s;">
                    <div class="me-3 fs-4">
                        <i class="bi ${icon}"></i>
                    </div>
                    <div>
                        <h6 class="mb-1 fw-bold text-dark" style="font-size: 0.9rem;">${n.title}</h6>
                        <small class="text-muted d-block mt-1" style="font-size: 0.8rem; line-height: 1.3;">${n.message}</small>
                        <small class="text-secondary mt-1 d-block" style="font-size: 0.7rem;">
                            ${new Date(n.createdAt).toLocaleDateString('uk-UA')} о ${new Date(n.createdAt).toLocaleTimeString('uk-UA', {hour: '2-digit', minute:'2-digit'})}
                        </small>
                    </div>
                </a>
            `;
        }).join('');
        
        // ВАЖЛИВО: повертаємо масив, щоб ним міг скористатися сокет!
        return notifications;
    } catch (err) {
        console.error("Помилка завантаження сповіщень:", err);
        return [];
    }
};

window.handleNotificationClick = async function(id, link, event) {
    event.preventDefault();
    const token = getNotifToken();
    try {
        await fetch(`${NOTIF_API_BASE}/notifications/read/${id}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (link && link !== 'null' && link !== '#') {
            window.location.href = link;
        } else {
            // Візуально відмічаємо прочитаним без рефрешу
            const row = event.currentTarget;
            row.classList.remove('bg-success', 'bg-opacity-10');
            row.classList.add('bg-white');
            
            const badge = document.getElementById('notificationBadge');
            let count = parseInt(badge.textContent);
            if(count > 1) {
                badge.textContent = count - 1;
            } else {
                badge.classList.add('d-none');
            }
        }
    } catch (e) { console.error(e); }
};

window.markAllAsRead = async function() {
    const badge = document.getElementById('notificationBadge');
    if (!badge || badge.classList.contains('d-none')) return;

    const token = getNotifToken();
    try {
        await fetch(`${NOTIF_API_BASE}/notifications/read-all`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        badge.classList.add('d-none');
        badge.textContent = '0';
        document.querySelectorAll('#notificationsList .dropdown-item').forEach(item => {
            item.classList.remove('bg-success', 'bg-opacity-10');
            item.classList.add('bg-white');
        });
    } catch (e) { console.error(e); }
};

// Функція малювання поп-апу (Тоаста) - ТЕПЕР ПРИЙМАЄ ПАРАМЕТР id
window.showToast = function(title, message, link, id) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toastEl = document.createElement('div');
    const cursorStyle = (link && link !== 'null' && link !== '#') ? 'cursor: pointer;' : '';
    
    toastEl.className = 'toast border-0 mb-3 shadow-lg rounded-4 overflow-hidden';
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.setAttribute('aria-atomic', 'true');
    toastEl.style.cssText = `${cursorStyle} min-width: 320px; max-width: 400px; background-color: #fff; z-index: 1055; transition: opacity 0.3s ease-in-out;`;
    
    const hoverBg = (link && link !== 'null' && link !== '#') ? 'onmouseover="this.style.backgroundColor=\'#f8f9fa\'" onmouseout="this.style.backgroundColor=\'#fff\'"' : '';

    toastEl.innerHTML = `
        <div class="d-flex" ${hoverBg}>
            <div class="bg-warning" style="width: 6px; flex-shrink: 0;"></div>
            <div class="toast-body p-3 w-100 text-dark">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <strong class="text-success fs-6"><i class="bi text-warning"></i>${title}</strong>
                    <button type="button" class="btn-close ms-3" data-bs-dismiss="toast" aria-label="Close" style="position: relative; z-index: 2;"></button>
                </div>
                <div class="text-muted" style="font-size: 0.95rem; line-height: 1.5; word-wrap: break-word; pointer-events: none;">
                    ${message}
                </div>
            </div>
        </div>
    `;
    
    // Клік по всьому тоасту (крім кнопки закриття)
    if (link && link !== 'null' && link !== '#') {
        toastEl.addEventListener('click', async (e) => {
            if (!e.target.closest('.btn-close')) {
                // 🔥 МАГІЯ: Якщо є ID, відправляємо запит на прочитання ПЕРЕД переходом!
                if (id) {
                    try {
                        const token = getNotifToken();
                        await fetch(`${NOTIF_API_BASE}/notifications/read/${id}`, {
                            method: 'PUT',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                    } catch(err) { console.error("Помилка відмітки", err); }
                }
                // Переходимо на сторінку
                window.location.href = link;
            }
        });
    }

    container.appendChild(toastEl);
    
    const bsToast = new bootstrap.Toast(toastEl, { autohide: true, delay: 6000 }); 
    bsToast.show();
    
    toastEl.addEventListener('hidden.bs.toast', () => {
        toastEl.remove();
    });
};

// ==========================================
// 🔥 ІНІЦІАЛІЗАЦІЯ ТА СОКЕТИ 🔥
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Завантажуємо початкові дані для дзвіночка
    if (document.getElementById('notificationsDropdown')) {
        loadNotifications();
    }

    // 2. Підключаємо сокети
    if (socket) {
        const myId = getUserId();
        if (myId) {
            socket.emit('join', myId);
            console.log("Socket підключено для студента:", myId);
        }

        // Слухаємо CRM-СПОВІЩЕННЯ
        socket.on('new_notification', async (data) => {
            console.log("Отримано нове CRM-сповіщення:", data);
            
            // 1. Завантажуємо свіжий список з бази (і отримуємо його в змінну)
            const freshNotifications = await loadNotifications(); 
            
            // 2. Шукаємо ID цього нового сповіщення
            let notifId = data._id || data.id; 
            if (!notifId && freshNotifications && freshNotifications.length > 0) {
                // Беремо найновіше непрочитане з таким самим заголовком
                const matched = freshNotifications.find(n => n.title === data.title && !n.isRead);
                if (matched) notifId = matched._id;
            }

            // 3. Показуємо поп-ап, ПЕРЕДАВШИ ЙОМУ ID!
            showToast(data.title, data.message, data.link, notifId); 
        });

        // Слухаємо ПОВІДОМЛЕННЯ В ЧАТ
        socket.on('newMessage', (msg) => {
            console.log("Отримано нове повідомлення в чаті:", msg);
            
            if (typeof updateStudentUnreadBadge === 'function') {
                updateStudentUnreadBadge();
            }

            if (typeof refreshCurrentChatSilent === 'function') {
                const senderId = typeof msg.sender === 'object' ? msg.sender._id : msg.sender;
                if (typeof currentReceiverId !== 'undefined' && currentReceiverId === senderId) {
                    refreshCurrentChatSilent();
                }
                if (typeof loadDialogs === 'function') loadDialogs(true);
            } 
            else if (typeof loadStudentMessageCenter === 'function') {
                loadStudentMessageCenter();
            }
        });
    }
});