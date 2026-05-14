// Використовуємо константу для бази, щоб легко міняти порт в одному місці
const API_URL = "http://localhost:5002/api/auth/login";

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const loginEmail = document.getElementById("loginEmail");
    const loginPassword = document.getElementById("loginPassword");
    const loginMessage = document.getElementById("loginMessage");
    const loginTogglePassword = document.getElementById("loginTogglePassword");

    // 1. Перемикач видимості пароля
    if (loginTogglePassword) {
        loginTogglePassword.addEventListener("click", () => {
            const isPassword = loginPassword.type === "password";
            loginPassword.type = isPassword ? "text" : "password";
            loginTogglePassword.className = isPassword ? "bi bi-eye-slash" : "bi bi-eye";
        });
    }

    // 2. Обробка входу
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        // Очищуємо попередні повідомлення
        loginMessage.textContent = "";
        loginMessage.className = "text-danger small mt-2"; 

        const email = loginEmail.value.trim();
        const password = loginPassword.value;

        if (!email || !password) {
            loginMessage.textContent = "Будь ласка, заповніть усі поля";
            return;
        }

        try {
            console.log("📡 Спроба входу для:", email);

            const response = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();



        if (response.ok) {
            console.log("✅ Вхід успішний, отримуємо токен...");

            // 🔥 1. Спочатку запам'ятовуємо посилання для редиректу (якщо воно є)
            // Ми робимо це ДО localStorage.clear()
            const redirectTo = localStorage.getItem("redirectAfterLogin");

            // КРИТИЧНО: Очищуємо старі дані перед записом нових
            localStorage.clear();

            // 2. Зберігаємо нові дані
            localStorage.setItem("token", data.token); 
            await prefetchCourses(data.token);

            const userId = data.userId || (data.user && data.user._id) || data._id;
            if (userId) {
                localStorage.setItem("userId", userId);
            }

            localStorage.setItem("user", JSON.stringify({
                name: data.name,
                email: data.email,
                role: data.role || "student"
            }));

            // 3. Робота з модальним вікном та ПЕРЕХОДОМ
            const modalElement = document.getElementById("registerMessageModal");
            const modalText = document.getElementById("registerMessageModalText");
            
            if (modalElement && modalText) {
                modalText.textContent = `Вхід успішний! Вітаємо, ${data.name} 🌿`;
                const modal = new bootstrap.Modal(modalElement);
                modal.show();

                setTimeout(() => {
                    modal.hide();
                    // 🔥 4. ПЕРЕВІРКА: Куди перенаправити?
                    if (redirectTo) {
                        console.log("🚀 Повертаємо користувача до сповіщення:", redirectTo);
                        window.location.href = redirectTo;
                    } else {
                        redirectByUserRole(data.role);
                    }
                }, 1500);
            } else {
                // Якщо модалки немає, робимо таку ж перевірку
                if (redirectTo) {
                    window.location.href = redirectTo;
                } else {
                    redirectByUserRole(data.role);
                }
            }

        } else {
                // Сервер повернув помилку (наприклад, невірний пароль)
                loginMessage.textContent = data.message || "Неправильна пошта або пароль";
            }
        } catch (err) {
            console.error("🚨 Помилка мережі:", err);
            loginMessage.textContent = "Сервер недоступний. Перевір, чи запущений бекенд на порту 5002";
        }
    });
});

// Функція для перенаправлення
function redirectByUserRole(role) {
    console.log("🔀 Перенаправлення для ролі:", role);
    switch (role) {
        case "admin":
            window.location.href = "admin/admin.html";
            break;
        case "teacher":
            window.location.href = "teacher/teacher.html";
            break;
        default:
            // Шлях до кабінету студента
            window.location.href = "student/student.html";
    }
}

async function prefetchCourses(token) {
    try {
        // Замініть на ваш реальний роут, який повертає КУРСИ СТУДЕНТА
        const res = await fetch("http://localhost:5002/api/courses/student/my-courses", {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
            const courses = await res.json();
            // Кешуємо весь список
            localStorage.setItem("user_courses_data", JSON.stringify(courses));
            // Кешуємо кожен курс окремо за ID для сторінки навчання
            courses.forEach(c => localStorage.setItem(`course_cache_${c._id}`, JSON.stringify(c)));
            console.log("🚀 Дані успішно закешовано");
        }
    } catch (e) { console.error("Prefetch failed", e); }
}