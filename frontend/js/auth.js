const API_BASE_URL = "http://localhost:5002/api";

document.addEventListener("DOMContentLoaded", () => {
    
    // ==========================================
    // ЛОГІКА РЕЄСТРАЦІЇ
    // ==========================================
    const registerForm = document.getElementById("registerForm");
    const regPassword = document.getElementById("registerPassword");
    const regEmail = document.getElementById("registerEmail");
    const toggleRegPass = document.getElementById("togglePassword");
    const regRules = document.getElementById("passwordRules");
    const regBtn = document.getElementById("registerSubmitBtn");
    const regMsg = document.getElementById("registerMessage");

    if (toggleRegPass) {
        toggleRegPass.addEventListener('click', () => {
            const isPass = regPassword.type === 'password';
            regPassword.type = isPass ? 'text' : 'password';
            toggleRegPass.className = isPass ? 'bi bi-eye-slash' : 'bi bi-eye';
        });
    }

    function validatePassword(password) {
        return {
            length: password.length >= 8,
            letter: /[A-Za-z]/.test(password),
            digit: /\d/.test(password),
            upper: /[A-Z]/.test(password)
        };
    }

    if (regPassword) {
        regPassword.addEventListener("input", () => {
            const rules = validatePassword(regPassword.value);
            regRules.style.display = regPassword.value ? "block" : "none";

            const updateRule = (id, isValid, text) => {
                const el = document.getElementById(id);
                // Використовуємо твої класи invalid/valid якщо треба, або просто кольори
                el.className = isValid ? "text-success fw-bold" : "text-danger";
                el.innerHTML = isValid ? `<i class="bi bi-check-circle-fill me-1"></i> ${text}` : `<i class="bi bi-dot"></i> ${text}`;
            };

            updateRule("rule-length", rules.length, "Мінімум 8 символів");
            updateRule("rule-letter", rules.letter, "Хоча б одна буква");
            updateRule("rule-digit", rules.digit, "Хоча б одна цифра");
            updateRule("rule-upper", rules.upper, "Велика літера");
        });
    }

    if (registerForm) {
        registerForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            regMsg.textContent = "";

            const name = document.getElementById("registerName").value.trim();
            const email = regEmail.value.trim();
            const password = regPassword.value;
            const role = document.getElementById("registerRole").value;

            const rules = validatePassword(password);
            if (!rules.length || !rules.letter || !rules.digit || !rules.upper) {
                regRules.style.display = "block";
                return;
            }

            // Змінюємо текст кнопки на лоадер
            regBtn.disabled = true;
            const originalBtnText = regBtn.innerHTML;
            regBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Створення...`;

            try {
                const response = await fetch(`${API_BASE_URL}/auth/signup`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, email, password, role })
                });

                const data = await response.json();

                if (response.ok) {
                    // Пишемо успіх прямо на твоїй зеленій кнопці
                    regBtn.innerHTML = `<i class="bi bi-check-circle-fill me-2"></i> Успішно!`;
                    regMsg.className = "text-success mt-3 text-center small fw-bold";
                    regMsg.textContent = "Перевірте пошту для активації акаунту.";
                    registerForm.reset();
                    regRules.style.display = "none";
                } else {
                    regMsg.className = "text-danger mt-3 text-center small fw-bold";
                    regMsg.textContent = data.message || "Помилка при реєстрації";
                    regBtn.disabled = false;
                    regBtn.innerHTML = originalBtnText;
                }
            } catch (err) {
                regMsg.className = "text-danger mt-3 text-center small fw-bold";
                regMsg.textContent = "Помилка з'єднання з сервером";
                regBtn.disabled = false;
                regBtn.innerHTML = originalBtnText;
            }
        });
    }

    // ==========================================
    // ЛОГІКА ВХОДУ
    // ==========================================
    const loginForm = document.getElementById("loginForm");
    const loginEmail = document.getElementById("loginEmail");
    const loginPassword = document.getElementById("loginPassword");
    const loginMsg = document.getElementById("loginMessage");
    const toggleLogPass = document.getElementById("loginTogglePassword");
    const loginBtn = document.getElementById("loginSubmitBtn");

    if (toggleLogPass) {
        toggleLogPass.addEventListener("click", () => {
            const isPass = loginPassword.type === "password";
            loginPassword.type = isPass ? "text" : "password";
            toggleLogPass.className = isPass ? "bi bi-eye-slash" : "bi bi-eye";
        });
    }

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            loginMsg.textContent = "";

            const email = loginEmail.value.trim();
            const password = loginPassword.value;

            loginBtn.disabled = true;
            const originalBtnText = loginBtn.innerHTML;
            loginBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Вхід...`;

            try {
                const response = await fetch(`${API_BASE_URL}/auth/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (response.ok) {
                    // Анімація успіху на твоїй зеленій кнопці
                    loginBtn.innerHTML = `<i class="bi bi-shield-check me-2"></i> Вхід успішний!`;
                    
                    const redirectTo = localStorage.getItem("redirectAfterLogin");
                    localStorage.clear();
                    localStorage.setItem("token", data.token); 
                    const userId = data.userId || (data.user && data.user._id) || data._id;
                    if (userId) localStorage.setItem("userId", userId);
                    
                    localStorage.setItem("user", JSON.stringify({
                        name: data.name,
                        email: data.email,
                        role: data.role || "student"
                    }));

                    // Чекаємо секунду, щоб юзер побачив галочку, і робимо редірект
                    setTimeout(() => {
                        if (redirectTo) {
                            window.location.href = redirectTo;
                        } else {
                            redirectByUserRole(data.role);
                        }
                    }, 1000);

                } else {
                    loginMsg.textContent = data.message || "Неправильна пошта або пароль";
                    loginBtn.disabled = false;
                    loginBtn.innerHTML = originalBtnText;
                }
            } catch (err) {
                loginMsg.textContent = "Сервер недоступний.";
                loginBtn.disabled = false;
                loginBtn.innerHTML = originalBtnText;
            }
        });
    }

    function redirectByUserRole(role) {
        switch (role) {
            case "admin": window.location.href = "admin/admin.html"; break;
            case "teacher": window.location.href = "teacher/teacher.html"; break;
            default: window.location.href = "student/student.html";
        }
    }
});

  // 1. Примусово кажемо браузеру: "Я сам керую скролом"
  if (history.scrollRestoration) {
    history.scrollRestoration = 'manual';
  }

  // 2. Функція для жорсткого скидання
  const resetScroll = () => {
    window.scrollTo(0, 0);
    
    // Якщо в адресному рядку висить #courses-top, прибираємо його без перезавантаження
    if (window.location.hash) {
      history.replaceState("", document.title, window.location.pathname + window.location.search);
    }
  };

  // 3. Спрацьовуємо відразу
  resetScroll();

  // 4. Спрацьовуємо ще раз, коли сторінка ПОВНІСТЮ готова (картинки, стилі)
  window.addEventListener('load', resetScroll);

  // 5. Маленький "милиця" на 100мс для гарантії (інколи браузер тупить на старті)
  setTimeout(resetScroll, 100);