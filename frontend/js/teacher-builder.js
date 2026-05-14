// frontend/js/teacher-builder.js

const API_BASE_URL = 'http://localhost:5002/api/courses';
const IMAGE_API_URL = 'http://localhost:5002/api/image';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('createCourseForm');
    const publicToggle = document.getElementById('publicToggle');
    const publicLabel = document.getElementById('publicToggleLabel');
    const fileInput = document.getElementById('courseFile');
    const priceInput = document.getElementById('coursePrice');

    // 1. Автозавантаження при виборі файлу
    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                await window.uploadCourseCover();
            }
        });
    }

    // 2. Логіка публічності (Модалка)
    if (publicToggle && publicLabel) {
        publicToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                const visModal = new bootstrap.Modal(document.getElementById('visibilityInfoModal'));
                visModal.show();
                e.target.checked = false;
                publicLabel.textContent = "Приватний";
            }
        });
    }

    // 3. Розрахунок доходу вчителя
    if (priceInput) {
        priceInput.addEventListener('input', () => {
            const price = parseInt(priceInput.value) || 0;
            const displayFee = document.getElementById('displayFee');
            const displayNet = document.getElementById('displayNet');
            const errorMsg = document.getElementById('priceValidationError');
            const submitBtn = document.getElementById('submitBtn');

            if (price === 0) {
                displayFee.innerText = "0 ₴";
                displayNet.innerText = "0 ₴ (Безкоштовно)";
                errorMsg.classList.add('d-none');
                submitBtn.disabled = false;
                return;
            }

            if (price < 70) {
                errorMsg.classList.remove('d-none');
                displayFee.innerText = "—";
                displayNet.innerText = "—";
                submitBtn.disabled = true;
                return;
            }

            errorMsg.classList.add('d-none');
            submitBtn.disabled = false;

            let fee = Math.round(price * 0.25);
            if (fee < 50) fee = 50;
            displayFee.innerText = `${fee} ₴`;
            displayNet.innerText = `${price - fee} ₴`;
        });
    }

    // 4. Створення курсу
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = document.getElementById('submitBtn');
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Створюємо...`;

            let teacherId = localStorage.getItem('userId'); 
            if (!teacherId || teacherId === "null") {
                const userData = localStorage.getItem('user'); 
                if (userData) {
                    const parsedUser = JSON.parse(userData);
                    teacherId = parsedUser._id || parsedUser.id;
                }
            }

            const courseData = {
                title: document.getElementById('courseTitle').value.trim(),
                description: document.getElementById('courseDescription').value.trim(),
                image: document.getElementById('courseImageUrl').value.trim() || "", 
                price: parseInt(document.getElementById('coursePrice').value) || 0,
                author: teacherId, 
                authorRole: "teacher", 
                isPublic: false,
                isSystem: false
            };

            try {
                const res = await fetch(`${API_BASE_URL}/add`, { 
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify(courseData)
                });

                const result = await res.json();
                if (res.ok) {
                    window.location.href = `teacher-course-edit.html?id=${result.course?._id || result._id}`;
                } else {
                    throw new Error(result.error || 'Помилка створення');
                }
            } catch (error) {
                alert(error.message);
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }
});

// === ДОПОМІЖНІ ФУНКЦІЇ (API) ===
async function uploadImageAPI(file) {
    const formData = new FormData();
    formData.append("image", file);
    try {
        const res = await fetch(IMAGE_API_URL, { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Помилка завантаження");
        return data.url;
    } catch (err) { throw err; }
}

// === ГОЛОВНІ ФУНКЦІЇ (WINDOW) ===

window.uploadCourseCover = async function() {
    const fileInput = document.getElementById('courseFile');
    const previewImg = document.getElementById('previewImg');
    const delBtn = document.getElementById('deleteCourseImageBtn');
    const uploadBox = document.getElementById('uploadBox'); // Зона завантаження

    if (!fileInput || !fileInput.files[0]) return;

    try {
        const url = await uploadImageAPI(fileInput.files[0]);
        document.getElementById('courseImageUrl').value = url;
        
        if (previewImg) {
            previewImg.src = url;
            previewImg.classList.remove('d-none'); 
        }
        
        // Ховаємо зону завантаження і показуємо кнопку видалення
        if (uploadBox) uploadBox.classList.add('d-none');
        if (delBtn) delBtn.classList.remove('d-none');
        
    } catch(err) { 
        alert("Помилка: " + err.message); 
        fileInput.value = "";
    }
};

window.removeCourseCover = function() {
    const urlInput = document.getElementById('courseImageUrl');
    if (!urlInput.value) return;

    // Відкриваємо модалку замість alert
    const delModal = new bootstrap.Modal(document.getElementById('confirmDeleteCoverModal'));
    delModal.show();
};

window.executeDeleteCover = async function() {
    const urlInput = document.getElementById('courseImageUrl');
    const preview = document.getElementById('previewImg');
    const delBtn = document.getElementById('deleteCourseImageBtn');
    const fileInput = document.getElementById('courseFile');
    const uploadBox = document.getElementById('uploadBox');

    try {
        await fetch(IMAGE_API_URL, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: urlInput.value })
        });

        // Очищаємо все
        urlInput.value = "";
        if (preview) { preview.classList.add('d-none'); preview.src = ""; }
        if (fileInput) fileInput.value = "";
        
        // Повертаємо зону завантаження
        if (delBtn) delBtn.classList.add('d-none');
        if (uploadBox) uploadBox.classList.remove('d-none');

        // Закриваємо модалку
        const modalEl = document.getElementById('confirmDeleteCoverModal');
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        modalInstance?.hide();

    } catch (err) { console.error(err); }
};