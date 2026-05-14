// js/admin-navbar-loader.js

const ADMIN_NAVBAR_HTML = `
<style>
  /* ФІКС БЛАКИТНОГО КОЛЬОРУ ПРИ ЗАТИСКАННІ В МЕНЮ КОНТЕНТ */
  #adminNavbarNav .dropdown-item:active,
  #adminNavbarNav .dropdown-item.active {
    background-color: rgba(68, 191, 105, 0.15) !important; /* Легкий зелений фон замість синього */
    color: #1b5e20 !important; /* Темно-зелений текст */
    outline: none !important;
  }
  
  /* Додатково фіксимо фокус, щоб ніяких синіх рамок не було */
  #adminNavbarNav .dropdown-item:focus {
    background-color: rgba(68, 191, 105, 0.05) !important;
    color: #1b5e20 !important;
    outline: none !important;
  }
</style>

<nav class="navbar navbar-expand-lg">
  <div class="container-fluid px-lg-5 px-3">
    <a class="navbar-brand border-end border-secondary border-opacity-25 pe-3 me-2 d-flex align-items-center" href="admin.html">
      <img src="../img/logo.png" alt="Lexora" class="logo" style="height: 40px;">
      <span class="badge ms-2 fs-7" style="background-color: #1b5e20 !important; color: #ffffff !important">Admin</span>
    </a>
    
    <button class="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#adminNavbarNav">
      <span class="navbar-toggler-icon"></span>
    </button>
    
    <div class="collapse navbar-collapse" id="adminNavbarNav">
      <ul class="navbar-nav me-auto mb-2 mb-lg-0 gap-1 gap-lg-3 mt-3 mt-lg-0">
        <li class="nav-item"><a class="nav-link px-2" id="nav-admin-home" href="admin.html">Дашборд</a></li>
        
        <li class="nav-item dropdown">
          <a class="nav-link px-2 dropdown-toggle" id="nav-admin-content" href="#" data-bs-toggle="dropdown">Контент</a>
          <ul class="dropdown-menu shadow border-0 rounded-4 p-2 mt-2" style="min-width: 210px;">
            <li class="mb-1">
              <a class="dropdown-item py-2 px-3 rounded-3 fw-bold" href="add.html" style="color: #1b5e20 !important;">
                Додати курс
              </a>
            </li>
            <li class="mb-1">
              <a class="dropdown-item py-2 px-3 rounded-3 fw-bold" href="edit.html" style="color: #1b5e20 !important;">
                Редагувати контент
              </a>
            </li>
            <li><hr class="dropdown-divider mx-2"></li>
            <li>
              <a class="dropdown-item py-2 px-3 rounded-3 fw-bold" href="delete.html" style="color: #1b5e20 !important;">
                Видалити матеріали
              </a>
            </li>
          </ul>
        </li>

        <li class="nav-item"><a class="nav-link px-2" id="nav-admin-users" href="admin-users.html">Користувачі</a></li>
        <li class="nav-item"><a class="nav-link px-2" id="nav-admin-finance" href="admin-finance.html">Фінанси</a></li>
      </ul>

      <ul class="navbar-nav align-items-center gap-3">
        <li class="nav-item">
          <a class="nav-link position-relative px-2 text-success" href="admin-tickets.html" title="Helpdesk">
            <i class="bi bi-headset fs-5"></i> 
          </a>
        </li>

        <li class="nav-item dropdown">
          <a class="nav-link position-relative px-2" href="#" id="adminNotifDropdown" data-bs-toggle="dropdown">
            <i class="bi bi-bell-fill fs-5"></i>
            <span id="adminNotifBadge" class="position-absolute top-0 start-100 translate-middle badge rounded-pill badge-notification d-none">0</span>
          </a>
          <ul class="dropdown-menu dropdown-menu-end shadow-lg border-0" id="adminNotifListMenu" style="width: 350px; border-radius: 15px;">
            <div class="p-3 border-bottom bg-light text-center" style="border-radius: 15px 15px 0 0;">
              <h6 class="mb-0 fw-bold text-success">Системні сповіщення</h6>
            </div>
            <div id="adminNotifList" style="max-height: 350px; overflow-y: auto;">
              <div class="text-center p-4 text-muted small">Немає нових сповіщень</div>
            </div>
            <div class="p-2 border-top text-center bg-light" style="border-radius: 0 0 15px 15px;">
              <button onclick="markAllAdminNotifsAsRead()" class="btn btn-link text-decoration-none text-muted small p-0 fw-bold">Позначити всі як прочитані</button>
            </div>
          </ul>
        </li>

        <li class="nav-item ms-lg-3">
          <a class="nav-link d-flex align-items-center px-2" id="nav-admin-profile" href="profile.html" style="color: #1b5e20 !important; text-decoration: none !important;">
            <div id="navAdminAvatarContainer" class="me-2 overflow-hidden rounded-circle d-flex align-items-center justify-content-center fw-bold text-white shadow-sm" style="width: 32px; height: 32px; background: linear-gradient(135deg, #1b5e20, #003300); font-size: 1rem;">
                <span id="navAdminInitials">A</span>
            </div>
            <span id="adminNavName" style="font-weight: 700;">Профіль</span>
          </a>
        </li>
        
        <li class="nav-item d-none d-lg-flex align-items-center border-start border-secondary border-opacity-25 ps-3 ms-2">
          <button onclick="logoutAdmin()" class="nav-link bg-transparent border-0 d-flex align-items-center gap-2 m-0 px-2 py-0 text-danger" style="font-weight: 700 !important;">
            <i class="bi bi-box-arrow-right fs-5"></i> Вихід
          </button>
        </li>
      </ul>
    </div>
  </div>
</nav>
`;

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('admin-navbar-placeholder');
    if (container) container.innerHTML = ADMIN_NAVBAR_HTML;

    const path = window.location.pathname;
    if (path.includes('admin.html')) document.getElementById('nav-admin-home')?.classList.add('active-link');
    if (path.includes('admin-users.html')) document.getElementById('nav-admin-users')?.classList.add('active-link');
    if (path.includes('admin-finance.html')) document.getElementById('nav-admin-finance')?.classList.add('active-link');
    if (path.includes('add.html') || path.includes('edit.html') || path.includes('delete.html')) {
        document.getElementById('nav-admin-content')?.classList.add('active-link');
    }

    const user = JSON.parse(localStorage.getItem('user'));
    if (user && user.name) {
        const initialsDisplay = document.getElementById('navAdminInitials');
        if (initialsDisplay) initialsDisplay.textContent = user.name.charAt(0).toUpperCase();
    }
});

window.markAllAdminNotifsAsRead = async function() {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`http://localhost:5002/api/notifications/read-all`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            if (typeof loadAdminNotifications === 'function') loadAdminNotifications();
            const badge = document.getElementById('adminNotifBadge');
            if (badge) badge.classList.add('d-none');
        }
    } catch (err) { console.error(err); }
};

window.logoutAdmin = function() {
    localStorage.clear();
    window.location.href = '../index.html';
};