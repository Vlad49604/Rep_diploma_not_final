(function() {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    let user = null;

    try {
        user = userStr ? JSON.parse(userStr) : null;
    } catch (e) {
        console.error("Помилка парсингу даних користувача");
    }

    // 🔥 ПЕРЕВІРКА: Якщо це НЕ адмін (або взагалі не залогінений)
    if (!token || !user || user.role !== 'admin') {
        console.error("⛔ Спроба доступу до адмінки без прав!");

        if (user) {
            // 👨‍🏫 Якщо це вчитель — перекидаємо в кабінет вчителя
            if (user.role === 'teacher') {
                window.location.href = '../teacher/teacher.html';
            } 
            // 🎓 Якщо це студент — у кабінет студента
            else if (user.role === 'student') {
                window.location.href = '../student/student.html';
            } 
        } else {
            // 🔑 Якщо токена взагалі немає — на логін
            window.location.href = '../index.html';
        }
    }
})();