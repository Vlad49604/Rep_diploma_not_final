const DASHBOARD_API_URL = 'http://localhost:5002/api/admin/dashboard-stats';
const token = localStorage.getItem('token');

document.addEventListener('DOMContentLoaded', loadMainDashboard);

async function loadMainDashboard() {
    try {
        const res = await fetch(DASHBOARD_API_URL, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error("Помилка завантаження");
        const data = await res.json();

        renderGrowthChart(data.growth);
        renderFunnelChart(data.funnel);
        renderGpaChart(data.gpa);

    } catch (err) {
        console.error(err);
        // Якщо сервер ще не готовий, не ламаємо сторінку
    }
}

// 1. Лінійний графік росту (Динаміка реєстрацій)
function renderGrowthChart(growthData) {
    const ctx = document.getElementById('growthChart');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: growthData.labels,
            datasets: [
                {
                    label: 'Студенти',
                    data: growthData.students,
                    borderColor: '#198754', // Зелений
                    backgroundColor: 'rgba(25, 135, 84, 0.1)',
                    borderWidth: 3,
                    tension: 0.4, // Плавні лінії
                    fill: true
                },
                {
                    label: 'Викладачі',
                    data: growthData.teachers,
                    borderColor: '#0d6efd', // Синій
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [5, 5], // Пунктир
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: {
                y: { beginAtZero: true, grid: { borderDash: [2, 4] } },
                x: { grid: { display: false } }
            }
        }
    });
}

// 2. Горизонтальний Bar Chart (Воронка продажів)
function renderFunnelChart(funnelData) {
    const ctx = document.getElementById('funnelChart');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Зареєстровані', 'Почали навчання', 'Оплатили курс'],
            datasets: [{
                data: [funnelData.total, funnelData.active, funnelData.buyers],
                backgroundColor: ['#adb5bd', '#ffc107', '#198754'],
                borderRadius: 5,
                barPercentage: 0.6
            }]
        },
        options: {
            indexAxis: 'y', // Робить графік горизонтальним!
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { display: false }, // Ховаємо нижню шкалу
                y: { grid: { display: false }, border: { display: false } }
            }
        }
    });
}

// 3. Кругова діаграма (GPA платформи)
function renderGpaChart(gpa) {
    document.getElementById('globalGpaValue').textContent = `${gpa}%`;
    const ctx = document.getElementById('gpaChart');
    
    // Колір залежить від балу
    const color = gpa >= 75 ? '#198754' : (gpa >= 50 ? '#ffc107' : '#dc3545');

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Засвоєно', 'Втрачено'],
            datasets: [{
                data: [gpa, 100 - gpa],
                backgroundColor: [color, '#e9ecef'],
                borderWidth: 0,
                cutout: '75%'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } }
        }
    });
}