(function() {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    let user = null;

    try {
        user = userStr ? JSON.parse(userStr) : null;
    } catch (e) {
        console.error("Помилка перевірки ролі");
    }

    // 🔥 ГОЛОВНА ПЕРЕВІРКА:
    // Якщо немає токена АБО роль не 'teacher' (адміна теж пускаємо, бо він головний)
    if (!token || !user || (user.role !== 'teacher' && user.role !== 'admin')) {
        console.warn("⛔ Доступ заборонено! Немає необхідної ролі.");
        
        // Якщо це студент — викидаємо в його кабінет
        if (user && user.role === 'student') {
            window.location.href = '../student/student.html';
        } else {
            // Якщо взагалі не залогінений — на головну
            window.location.href = '../index.html';
        }
    }
})();