// js/teacher-notifications.js
const NOTIF_BASE_URL = 'http://localhost:5002'; 

function getCleanId(idObj) {
    if (!idObj) return null;
    if (typeof idObj === 'string') return idObj;
    if (idObj.$oid) return idObj.$oid;
    if (typeof idObj === 'object') {
        return idObj._id ? getCleanId(idObj._id) : (idObj.id ? getCleanId(idObj.id) : null);
    }
    return idObj.toString();
}

function getAuthHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
    };
}

document.addEventListener('DOMContentLoaded', () => {
    const userDataStr = localStorage.getItem('user');
    let userId = localStorage.getItem('userId');

    if (userDataStr) {
        try {
            const user = JSON.parse(userDataStr);
            if (!userId || userId === "null") {
                userId = getCleanId(user._id) || getCleanId(user.id) || getCleanId(user);
            }
        } catch (e) {}
    }

    if (userId && userId !== "null") {
        // Перше завантаження
        loadNotifications(userId);
        if (typeof updateTeacherUnreadBadge === 'function') updateTeacherUnreadBadge();

        // Ініціалізація ЄДИНОГО сокета
        if (typeof io !== 'undefined') {
            const socket = io(NOTIF_BASE_URL);
            
            socket.on('connect', () => {
                socket.emit('join', userId);
                console.log('✅ Вчитель підключений до Socket.io:', userId);
            });

            // 1. Слухаємо ДЗВІНОЧОК (Сповіщення)
            socket.on('new_notification', (data) => {
                console.log('🔔 Нове сповіщення:', data);
                showToast(data.title, data.message, data.link);
                loadNotifications(userId); // Оновлюємо список у дзвонику
            });

            // 2. Слухаємо ПОВІДОМЛЕННЯ (Чат)
            socket.on('newMessage', (msg) => {
                console.log('📨 Нове повідомлення в чат:', msg);
                
                // Оновлюємо бейдж у навбарі
                if (typeof updateTeacherUnreadBadge === 'function') {
                    updateTeacherUnreadBadge();
                }

                // Оновлюємо великий банер на головній сторінці викладача (якщо ми на ній)
                if (typeof loadMessageCenter === 'function') {
                    loadMessageCenter();
                }

                // Якщо вчитель прямо зараз сидить у чаті - оновлюємо чат (опціонально)
                if (typeof refreshCurrentChatSilent === 'function') {
                    refreshCurrentChatSilent();
                }
            });
        }
    }
});

async function loadNotifications(userId) {
    const list = document.getElementById('notificationsList');
    const badge = document.getElementById('notificationBadge');
    if (!list) return;

    try {
        const res = await fetch(`${NOTIF_BASE_URL}/api/notifications/${userId}`, {
            headers: getAuthHeaders()
        });
        const notifications = await res.json();

        // Оновлюємо цифру на дзвонику
        const unreadCount = notifications.filter(n => !n.isRead).length;
        if (badge) {
            badge.textContent = unreadCount;
            unreadCount > 0 ? badge.classList.remove('d-none') : badge.classList.add('d-none');
        }

        if (notifications.length === 0) {
            list.innerHTML = '<div class="text-center p-4 text-muted small">Немає сповіщень</div>';
            return;
        }

        list.innerHTML = notifications.map(n => {
            const icon = n.type === 'warning' ? 'bi-exclamation-circle-fill text-warning' : 'bi-info-circle-fill text-success';
            const bgClass = n.isRead ? 'bg-white' : 'bg-success bg-opacity-10';

            return `
                <a href="#" class="dropdown-item py-3 border-bottom ${bgClass}" 
                   onclick="handleNotificationClick('${getCleanId(n._id)}', '${n.link || ''}', event)">
                    <div class="d-flex align-items-center">
                        <div class="me-3 fs-4"><i class="bi ${icon}"></i></div>
                        <div style="white-space: normal;">
                            <h6 class="mb-0 fw-bold" style="font-size: 0.9rem;">${n.title}</h6>
                            <small class="text-muted d-block mt-1">${n.message}</small>
                        </div>
                    </div>
                </a>`;
        }).join('');

    } catch (err) { console.error("Помилка завантаження", err); }
}

window.handleNotificationClick = async function(id, link, event) {
    if (event) event.preventDefault();
    try {
        await fetch(`${NOTIF_BASE_URL}/api/notifications/read/${id}`, { 
            method: 'PUT',
            headers: getAuthHeaders()
        });
        if (link && link !== 'null' && link.trim() !== '') {
            window.location.href = link;
        } else {
            location.reload();
        }
    } catch (err) { console.error(err); }
};

window.markAllAsRead = async function() {
    try {
        await fetch(`${NOTIF_BASE_URL}/api/notifications/read-all`, { method: 'PUT', headers: getAuthHeaders() });
        location.reload();
    } catch (e) { console.error(e); }
};

function showToast(title, message, link) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toastEl = document.createElement('div');
    toastEl.className = 'toast border-0 mb-3 shadow-lg rounded-4 overflow-hidden';
    toastEl.style.cssText = `min-width: 350px; background-color: #fff; z-index: 1055;`;
    toastEl.innerHTML = `
        <div class="d-flex">
            <div class="bg-success" style="width: 6px; flex-shrink: 0;"></div>
            <div class="toast-body p-3 w-100 text-dark">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <strong class="text-success"><i class="bi bi-bell-fill me-2"></i>${title}</strong>
                    <button type="button" class="btn-close ms-3" data-bs-dismiss="toast"></button>
                </div>
                <div class="text-muted" style="font-size: 0.95rem;">${message}</div>
            </div>
        </div>`;
    if (link) toastEl.onclick = (e) => { if (!e.target.closest('.btn-close')) window.location.href = link; };
    container.appendChild(toastEl);
    new bootstrap.Toast(toastEl, { delay: 7000 }).show();
    toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
}