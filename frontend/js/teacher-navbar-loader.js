// js/teacher-navbar-loader.js

const TEACHER_NAVBAR_HTML = `
<nav class="navbar navbar-expand-lg">
  <div class="container-fluid px-lg-5 px-3">
    <a class="navbar-brand border-end border-secondary border-opacity-25 pe-3 me-2 d-flex align-items-center" href="teacher.html">
      <img src="../img/logo.png" alt="Lexora" class="logo" style="height: 40px;">
      <span class="badge bg-success ms-2 fs-7" style="opacity: 0.8; background-color: #075c36 !important; color: #ffffff !important">Teacher</span>
    </a>
    
    <button class="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
      <span class="navbar-toggler-icon"></span>
    </button>
    
    <div class="collapse navbar-collapse" id="navbarNav">
      <ul class="navbar-nav me-auto mb-2 mb-lg-0 gap-1 gap-lg-3 mt-3 mt-lg-0">
        <li class="nav-item"><a class="nav-link px-2" id="nav-teacher-home" href="teacher.html">Мої курси</a></li>
        <li class="nav-item"><a class="nav-link px-2" id="nav-teacher-builder" href="teacher-builder.html">Конструктор</a></li>
        <li class="nav-item"><a class="nav-link px-2" id="nav-teacher-mailing" href="teacher-mailing.html">Розсилки</a></li>
      </ul>

      <ul class="navbar-nav align-items-center gap-3">
        <li class="nav-item">
          <a class="nav-link position-relative px-2" href="teacher-messages.html" title="Повідомлення">
            <i class="bi bi-chat-square-text fs-5"></i> 
            <span id="teacherNavUnreadCount" class="position-absolute top-0 start-100 translate-middle badge rounded-pill badge-notification d-none"></span>
          </a>
        </li>
        <li class="nav-item dropdown">
          <a class="nav-link position-relative px-2" href="#" id="notificationsDropdown" data-bs-toggle="dropdown">
            <i class="bi bi-bell-fill fs-5"></i>
            <span id="notificationBadge" class="position-absolute top-0 start-100 translate-middle badge rounded-pill badge-notification d-none">0</span>
          </a>
          <ul class="dropdown-menu dropdown-menu-end shadow border-0" id="notificationsListMenu" style="width: 320px; border-radius: 15px;">
            <div class="p-3 border-bottom bg-light text-center" style="border-radius: 15px 15px 0 0;">
              <h6 class="mb-0 fw-bold text-success">Сповіщення</h6>
            </div>
            <div id="notificationsList" style="max-height: 300px; overflow-y: auto;">
              <div class="text-center p-4 text-muted small">Завантаження...</div>
            </div>
            <div class="p-2 border-top text-center bg-light" style="border-radius: 0 0 15px 15px;">
              <button onclick="markAllAsRead()" class="btn btn-link text-decoration-none text-muted small p-0 fw-bold">Позначити всі як прочитані</button>
            </div>
          </ul>
        </li>

        <li class="nav-item ms-lg-3">
          <a class="nav-link d-flex align-items-center px-2" id="nav-teacher-profile" href="teacher-profile.html" style="color: #1b5e20 !important; text-decoration: none !important;">
            <div id="navAvatarContainer" class="me-2 overflow-hidden rounded-circle d-flex align-items-center justify-content-center fw-bold text-white shadow-sm" style="width: 32px; height: 32px; background: linear-gradient(135deg, #4caf50, #1b5e20); font-size: 1rem;">
                <span id="navUserInitials">T</span>
                <img id="navUserPhoto" src="" class="w-100 h-100 object-fit-cover d-none" alt="Avatar">
            </div>
            <span id="teacherNavName" style="font-weight: 700;">Викладач</span>
          </a>
        </li>
        
        <li class="nav-item d-none d-lg-flex align-items-center border-start border-secondary border-opacity-25 ps-3 ms-2">
          <button onclick="logout()" class="nav-link bg-transparent border-0 d-flex align-items-center gap-2 m-0 px-2 py-0">
            <i class="bi bi-box-arrow-right fs-5"></i> Вийти
          </button>
        </li>
      </ul>
    </div>
  </div>
</nav>
`;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Вставляємо навбар
    const container = document.getElementById('navbar-placeholder');
    if (container) {
        container.innerHTML = TEACHER_NAVBAR_HTML;
    }

    // 2. Підсвічуємо активне посилання (додано логіку для Розсилок)
    const path = window.location.pathname;
    if (path.includes('teacher.html')) document.getElementById('nav-teacher-home')?.classList.add('active-link');
    if (path.includes('teacher-builder.html')) document.getElementById('nav-teacher-builder')?.classList.add('active-link');
    if (path.includes('teacher-mailing.html')) document.getElementById('nav-teacher-mailing')?.classList.add('active-link');
    if (path.includes('teacher-profile.html')) document.getElementById('nav-teacher-profile')?.classList.add('active-link');
    
    // 3. Запускаємо оновлення даних користувача
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
        updateNavbarUI(user);
    }
});

function updateNavbarUI(user) {
    if (!user) return;
    const name = user.name || user.user?.name;
    const avatar = user.avatar || user.user?.avatar;

    const navNameEl = document.getElementById('teacherNavName');
    if (navNameEl) navNameEl.textContent = name;

    const navPhoto = document.getElementById('navUserPhoto');
    const navInitials = document.getElementById('navUserInitials');

    if (avatar && navPhoto) {
        navPhoto.src = avatar + '?t=' + new Date().getTime();
        navPhoto.classList.remove('d-none');
        if(navInitials) navInitials.classList.add('d-none');
    } else if (navInitials && name) {
        navInitials.textContent = name.charAt(0).toUpperCase();
        navInitials.classList.remove('d-none');
        if(navPhoto) navPhoto.classList.add('d-none');
    }
}

window.logout = function() {
    localStorage.clear();
    window.location.href = '../index.html';
};

// Функція для оновлення лічильника повідомлень у навбарі
window.updateTeacherUnreadBadge = async function() {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`http://localhost:5002/api/messages/unread-count`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const badge = document.getElementById('teacherNavUnreadCount');
        if (badge) {
            if (data.count > 0) {
                badge.textContent = data.count;
                badge.classList.remove('d-none');
            } else {
                badge.classList.add('d-none');
            }
        }
    } catch (err) {}
};

// Запускаємо один раз при старті
document.addEventListener('DOMContentLoaded', window.updateTeacherUnreadBadge);