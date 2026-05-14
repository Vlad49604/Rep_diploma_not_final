const API_URL = 'http://localhost:5002/api/admin/manage-users';
const token = localStorage.getItem('token');

// Зберігаємо дані глобально для пошуку
let allUsersData = [];

document.addEventListener('DOMContentLoaded', loadUsers);

// 1. ЗАВАНТАЖЕННЯ КОРИСТУВАЧІВ
async function loadUsers() {
    try {
        const response = await fetch(API_URL, { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        allUsersData = await response.json();
        
        // Рендеримо таблицю
        filterUsers(); 
        
    } catch (e) {
        console.error("Помилка завантаження користувачів", e);
    }
}

// 2. ФУНКЦІЯ ПОШУКУ (Фільтрація)
window.filterUsers = function() {
    const query = document.getElementById('searchUser').value.toLowerCase();
    
    const filtered = allUsersData.filter(u => 
        u.name.toLowerCase().includes(query) || 
        u.email.toLowerCase().includes(query)
    );
    
    renderTable(filtered);
};

// 3. РЕНДЕР ТАБЛИЦІ (Lexora Style)
// js/admin-users.js

function renderTable(users) {
    const tbody = document.getElementById('userTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Користувачів не знайдено</td></tr>';
        return;
    }

    users.forEach(user => {
        const isBanned = user.isBanned;
        const regDate = user.createdAt 
            ? new Date(user.createdAt).toLocaleDateString('uk-UA') 
            : '---';

        // 🔥 ПОВНА ПЕРЕРОБКА РОЛЕЙ: ТЕПЕР УСІ В СТИЛІ TEACHER (СОЛІДНИЙ ФОН + БІЛИЙ ТЕКСТ)
        let roleStyle = '';
        let roleName = user.role;

        if (user.role === 'admin') {
            // Адмін - солідний червоний (як небезпека, але професійно)
            roleStyle = 'background-color: #d32f2f !important; color: #ffffff !important; border: none !important;';
            roleName = 'Admin';
        } else if (user.role === 'teacher') {
            // Вчитель - глибокий зелений (Твій оригінальний стиль)
            roleStyle = 'background-color: #2E7D32 !important; color: #ffffff !important; border: none !important;';
            roleName = 'Teacher';
        } else {
            // Студент - яскравий зелений (Primary Lexora)
            roleStyle = 'background-color: #44BF69 !important; color: #ffffff !important; border: none !important;';
            roleName = 'Student';
        }

        tbody.innerHTML += `
            <tr class="align-middle">
                <td class="ps-4">
                    <div class="d-flex align-items-center gap-3">
                        <div class="bg-success bg-opacity-10 text-success rounded-circle d-flex align-items-center justify-content-center fw-bold shadow-sm" 
                             style="width: 42px; height: 42px; flex-shrink: 0; font-size: 1.1rem; border: 1px solid rgba(68, 191, 105, 0.2);">
                            ${user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div class="fw-bold text-dark fs-6">${user.name}</div>
                            <div class="text-muted" style="font-size: 0.8rem;">${user.email}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="badge rounded-pill px-3 py-2 shadow-sm" style="min-width: 100px; font-weight: 800; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; ${roleStyle}">
                        ${roleName}
                    </span>
                </td>
                <td>
                    <span class="badge ${isBanned ? 'bg-warning text-dark' : 'bg-success bg-opacity-10 text-success'} rounded-pill px-3 py-2 border">
                        ${isBanned ? 'Заблокований' : 'Активний'}
                    </span>
                </td>
                <td class="text-muted fw-bold" style="font-size: 0.9rem;">
                    ${regDate}
                </td>
                <td class="text-end pe-4">
                    <div class="d-flex justify-content-end align-items-center">
                        <a href="admin-user-details.html?id=${user._id}" 
                           class="btn btn-sm bg-success bg-opacity-10 text-success border-0 rounded-pill shadow-sm fw-bold d-inline-flex align-items-center justify-content-center" 
                           style="height: 38px; width: 120px; transition: 0.2s;">
                            Досьє <i class="bi bi-chevron-right ms-2"></i>
                        </a>
                    </div>
                </td>
            </tr>
        `;
    });
}