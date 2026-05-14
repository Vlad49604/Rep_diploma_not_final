const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Result = require('../models/Result');
const Draft = require('../models/Draft');
const User = require('../models/User');
const Course = require('../models/CourseModel'); // Щоб знайти, хто вчитель курсу
const sendNotification = require('../utils/notifier'); // Наша функція сповіщень

// Маршрут для збереження результатів
// Маршрут для збереження результатів
router.post('/save-result', async (req, res) => {
    try {
        const { user, course, sectionIdx, score, total, answers } = req.body;

        if (!mongoose.Types.ObjectId.isValid(user) || !mongoose.Types.ObjectId.isValid(course)) {
            return res.status(400).json({ error: 'ID користувача або курсу мають невірний формат' });
        }

        const newResult = new Result({
            user: new mongoose.Types.ObjectId(user),
            course: new mongoose.Types.ObjectId(course),
            sectionIdx: Number(sectionIdx),
            score: Number(score),
            total: Number(total),
            answers: answers 
        });

        await newResult.save();
        console.log(`✅ Прогрес збережено: Юзер ${user}, Секція ${sectionIdx}`);

        // =========================================
        // 🔥 СИСТЕМА СПОВІЩЕНЬ (CRM)
        // =========================================
        const courseDoc = await Course.findById(course);
        const userDoc = await User.findById(user); // Дістаємо ім'я студента
        
        if (courseDoc && userDoc) {
            const teacherId = courseDoc.author || courseDoc.teacher; 
            const io = req.app.get('io');

            if (teacherId) {
                const sectionTitle = courseDoc.sections && courseDoc.sections[sectionIdx] 
                    ? courseDoc.sections[sectionIdx].title 
                    : `Секція ${Number(sectionIdx) + 1}`;

                // 1. ПЕРЕВІРКА НА НИЗЬКИЙ БАЛ (< 40%)
                if (total > 0) {
                    const percent = score / total;
                    if (percent < 0.4) {
                        const notifLink = `/frontend/teacher/teacher-course-edit.html?id=${course}&student=${user}&result=${newResult._id}`;
                        const detailedMessage = `Студент <b>${userDoc.name}</b> провалив тест.<br>
                            <b class="text-dark">Курс:</b> ${courseDoc.title}<br>
                            <b class="text-dark">Тема:</b> ${sectionTitle}<br>
                            <span class="text-danger fw-bold">Оцінка: ${Math.round(percent * 100)}%</span>. Можливо, потрібна допомога.`;

                        await sendNotification({
                            userId: teacherId,
                            title: 'Увага: Низька успішність 📉',
                            message: detailedMessage,
                            type: 'error', // Червона іконка
                            link: notifLink
                        });

                        if (io) io.to(teacherId.toString()).emit('new_notification', {
                            title: 'Увага: Низька успішність 📉',
                            message: detailedMessage,
                            link: notifLink
                        });
                    }
                }

                // 2. ІСНУЮЧА ПЕРЕВІРКА НА ЕСЕ (Залишаємо як було)
                const essayTask = answers.find(ans => ans.taskType === 'essay');
                if (essayTask) {
                    const notifLink = `/frontend/teacher/teacher-course-edit.html?id=${course}&student=${user}&result=${newResult._id}&task=${essayTask.taskId}`;
                    const detailedMessage = `Студент <b>${userDoc.name}</b> здав розгорнуту відповідь.<br>
                        <b class="text-dark">Курс:</b> ${courseDoc.title}<br>
                        <b class="text-dark">Тема:</b> ${sectionTitle}`;

                    await sendNotification({
                        userId: teacherId,
                        title: 'Нове есе на перевірку 📝',
                        message: detailedMessage,
                        type: 'warning',
                        link: notifLink
                    });

                    if (io) io.to(teacherId.toString()).emit('new_notification', {
                        title: 'Нове есе на перевірку 📝',
                        message: detailedMessage,
                        link: notifLink
                    });
                }
            }
        }
        // =========================================

        res.status(201).json({ message: 'Результат успішно збережено!' });

    } catch (err) {
        console.error("🚨 Помилка при збереженні результату:", err.message);
        res.status(500).json({ error: 'Помилка на стороні сервера' });
    }
});

// Отримати результати користувача (ВИПРАВЛЕНО)
router.get('/user-stats/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        // ЗАХИСТ: Якщо userId це рядок "null" або просто невалідний - не мучимо базу
        if (!userId || userId === "null" || !mongoose.Types.ObjectId.isValid(userId)) {
            console.warn("⚠️ Запит статистики для невалідного UserID:", userId);
            return res.json([]); // Повертаємо порожній масив замість помилки 500
        }

        const results = await Result.find({ user: new mongoose.Types.ObjectId(userId) })
            .populate('course', 'title') 
            .sort({ completedAt: 1 });
            
        res.json(results);
    } catch (err) {
        console.error("🚨 Помилка завантаження статистики:", err.message);
        res.status(500).json({ error: 'Помилка завантаження статистики' });
    }
});

// Маршрут для збереження чернетки (Draft)
router.post('/save-draft', async (req, res) => {
    try {
        const { userId, courseId, sectionIdx, currentStep, savedAnswers } = req.body;

        if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(courseId)) {
            return res.status(400).json({ error: 'Невалідні ID для чернетки' });
        }

        // Примітка: переконайся, що модель Draft підключена (require) зверху, якщо вона в окремому файлі
        await Draft.findOneAndUpdate(
            { user: userId, course: courseId, sectionIdx },
            { currentStep, savedAnswers, updatedAt: Date.now() },
            { upsert: true }
        );

        res.status(200).json({ message: 'Прогрес збережено' });
    } catch (err) {
        console.error("🚨 Помилка збереження чернетки:", err.message);
        res.status(500).json({ error: 'Помилка збереження чернетки' });
    }
});

// Отримати всі чернетки користувача для конкретного курсу
router.get('/get-drafts/:userId/:courseId', async (req, res) => {
    try {
        const { userId, courseId } = req.params;
        const drafts = await Draft.find({ 
            user: userId, 
            course: courseId 
        });
        res.json(drafts);
    } catch (err) {
        res.status(500).json({ error: 'Помилка отримання чернеток' });
    }
});

// Видалення чернетки (скидання прогресу)
// Роут видалення чернетки
router.delete('/delete-draft/:userId/:courseId/:sectionIdx', async (req, res) => {
    try {
        const { userId, courseId, sectionIdx } = req.params;

        // ПЕРЕВІРКА: чи приходять дані (подивись в консоль сервера)
        console.log(`Видалення чернетки: User ${userId}, Course ${courseId}, Section ${sectionIdx}`);

        // Важливо: у тебе в базі поля називаються 'user' та 'course' (не userId/courseId)
        // Також переконайся, що ти імпортував модель Draft правильно
        const result = await Draft.deleteOne({ 
            user: userId,          // Поле в Compass називається 'user'
            course: courseId,      // Поле в Compass називається 'course'
            sectionIdx: parseInt(sectionIdx) 
        });

        if (result.deletedCount > 0) {
            console.log("✅ Чернетку успішно видалено з MongoDB");
            res.json({ message: "Успішно видалено" });
        } else {
            console.log("⚠️ Чернетку не знайдено для видалення");
            res.status(404).json({ message: "Чернетку не знайдено" });
        }
    } catch (err) {
        console.error("🚨 Помилка бекенду:", err);
        res.status(500).json({ error: err.message });
    }
});

// Маршрут для перенесення курсу в "Завершені"
router.post('/complete', async (req, res) => {
    try {
        const { userId, courseId } = req.body;

        // Валідація ID
        if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(courseId)) {
            return res.status(400).json({ error: 'Невалідні ID користувача або курсу' });
        }

        // 1. Знайти користувача
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "Користувача не знайдено" });
        }

        // 2. Перевірити, чи курс вже є в списку завершених (порівнюємо як рядки)
        const alreadyCompleted = user.completedCourses.some(
            id => id.toString() === courseId.toString()
        );

        if (!alreadyCompleted) {
            // 3. ВИДАЛЯЄМО з масиву активних (enrolledCourses)
            // Це важливо, щоб він зник з верхнього блоку на дашборді

            // 4. ДОДАЄМО в масив завершених
            user.completedCourses.push(courseId);

            await user.save();
            console.log(`✅ Курс ${courseId} перенесено в завершені для юзера ${userId}`);

            const Course = require('../models/CourseModel'); // Підключаємо модель (про всяк випадок)
            const courseDoc = await Course.findById(courseId);
            
            if (courseDoc) {
                const teacherId = courseDoc.author || courseDoc.teacher;
                if (teacherId) {
                    const notifLink = `/frontend/teacher/teacher-course-edit.html?id=${courseId}&student=${userId}`;
                    const detailedMessage = `Студент <b>${user.name}</b> щойно успішно завершив(ла) навчання!<br>
                        <b class="text-dark">Курс:</b> ${courseDoc.title} 🏆`;

                    await sendNotification({
                        userId: teacherId,
                        title: 'Успішне завершення курсу 🎓',
                        message: detailedMessage,
                        type: 'success', // Зелена іконка
                        link: notifLink
                    });

                    const io = req.app.get('io');
                    if (io) {
                        io.to(teacherId.toString()).emit('new_notification', {
                            title: 'Успішне завершення курсу 🎓',
                            message: detailedMessage,
                            link: notifLink
                        });
                    }
                }
            }
        }

        // Повертаємо оновленого юзера, щоб фронтенд міг оновити localStorage
        res.json({ 
            message: "Статус курсу оновлено успішно", 
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                enrolledCourses: user.enrolledCourses,
                completedCourses: user.completedCourses
            }
        });
    } catch (err) {
        console.error("🚨 Помилка на сервері при завершенні курсу:", err);
        res.status(500).json({ error: "Внутрішня помилка сервера" });
    }
});

module.exports = router;
module.exports = router;