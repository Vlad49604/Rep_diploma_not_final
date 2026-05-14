// js/student-navbar-loader.js

const NAVBAR_HTML = `
<nav class="navbar navbar-expand-lg">
  <div class="container-fluid px-lg-5 px-3">
    <a class="navbar-brand border-end border-secondary border-opacity-25 pe-3 me-2" href="student.html">
      <img src="../img/logo.png" alt="Lexora" class="logo" style="height: 40px;">
    </a>
    
    <button class="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
      <span class="navbar-toggler-icon "></span>
    </button>
    
    <div class="collapse navbar-collapse" id="navbarNav">
      <ul class="navbar-nav me-auto mb-2 mb-lg-0 gap-1 gap-lg-3 mt-3 mt-lg-0">
        <li class="nav-item"><a class="nav-link px-2" id="nav-home" href="student.html">Головна</a></li>
        <li class="nav-item"><a class="nav-link px-2" id="nav-monitoring" href="monitoring.html">Прогрес</a></li>
        <li class="nav-item"><a class="nav-link px-2" id="nav-my-courses" href="my-courses.html">Курси</a></li>
        <li class="nav-item"><a class="nav-link px-2" id="nav-catalog" href="courses.html">Каталог</a></li>
      </ul>

      <ul class="navbar-nav align-items-center gap-3">
        <li class="nav-item">
          <a class="nav-link position-relative px-2" href="student-messages.html" title="Повідомлення">
            <i class="bi bi-chat-square-text fs-5"></i> 
            <span id="studentNavUnreadCount" class="position-absolute top-0 start-100 translate-middle badge rounded-pill badge-notification d-none"></span>
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
          <a class="nav-link d-flex align-items-center px-2" id="nav-profile" href="profile.html" style="color: #1b5e20 !important; text-decoration: none !important;">
            <div id="navAvatarContainer" class="me-2 overflow-hidden rounded-circle d-flex align-items-center justify-content-center fw-bold text-white shadow-sm" style="width: 32px; height: 32px; background: linear-gradient(135deg, #4caf50, #1b5e20); font-size: 1rem;">
                <span id="navUserInitials">U</span>
                <img id="navUserPhoto" src="" class="w-100 h-100 object-fit-cover d-none" alt="Avatar">
            </div>
            <span id="studentNavName" style="font-weight: 700;">Student</span>
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
    // 1. Вставляємо навбар в контейнер
    const container = document.getElementById('navbar-placeholder');
    if (container) {
        container.innerHTML = NAVBAR_HTML;
    }

    // 2. Підсвічуємо активне посилання залежно від поточної сторінки
    const path = window.location.pathname;
    if (path.includes('student.html')) document.getElementById('nav-home')?.classList.add('active-link');
    if (path.includes('monitoring.html')) document.getElementById('nav-monitoring')?.classList.add('active-link');
    if (path.includes('my-courses.html')) document.getElementById('nav-my-courses')?.classList.add('active-link');
    if (path.includes('courses.html') && !path.includes('my-courses')) document.getElementById('nav-catalog')?.classList.add('active-link');
    if (path.includes('profile.html')) document.getElementById('nav-profile')?.classList.add('active-link');
    
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

    const navNameEl = document.getElementById('studentNavName');
    if (navNameEl) navNameEl.textContent = name;

    const navPhoto = document.getElementById('navUserPhoto');
    const navInitials = document.getElementById('navUserInitials');
    const navAvatarContainer = document.getElementById('navAvatarContainer');

    if (avatar && navPhoto) {
        navPhoto.src = avatar + '?t=' + new Date().getTime();
        navPhoto.classList.remove('d-none');
        if(navInitials) navInitials.classList.add('d-none');
    } else if (navInitials && name) {
        navInitials.textContent = name.charAt(0).toUpperCase();
        navInitials.classList.remove('d-none');
        if(navPhoto) navPhoto.classList.add('d-none');
    }

    const colorIndex = localStorage.getItem('avatarColorIndex');
    if (colorIndex && navAvatarContainer) {
        const colors = ['linear-gradient(135deg, #4caf50, #1b5e20)', 'linear-gradient(135deg, #2196f3, #0d47a1)', 'linear-gradient(135deg, #ff9800, #e65100)', 'linear-gradient(135deg, #9c27b0, #4a148c)', 'linear-gradient(135deg, #e91e63, #880e4f)'];
        navAvatarContainer.style.background = colors[colorIndex];
    }
    
    // Оновлюємо лічильник повідомлень
    updateStudentUnreadBadge();
}

async function updateStudentUnreadBadge() {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
        const res = await fetch(`http://localhost:5002/api/messages/unread-count`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const badge = document.getElementById('studentNavUnreadCount');
        if (badge && data.count > 0) {
            badge.textContent = data.count;
            badge.classList.remove('d-none');
        }
    } catch (err) {}
}

window.logout = function() {
    localStorage.clear();
    window.location.href = '../index.html';
};