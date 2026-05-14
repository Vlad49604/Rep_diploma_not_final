const express = require('express');
const router = express.Router();
const Invitation = require('../models/Invitation');
const User = require('../models/User');
const Course = require('../models/CourseModel');
const auth = require('../middleware/auth'); // Твій middleware для перевірки токена
const sendNotification = require('../utils/notifier');

// 1. Надіслати запрошення (для Викладача)
// 1. Надіслати запрошення
router.post('/send', auth, async (req, res) => {
    try {
        const { courseId, studentEmail, message } = req.body;

        const student = await User.findOne({ email: studentEmail.toLowerCase() });
        if (!student) return res.status(404).json({ message: 'Користувача не знайдено.' });
        if (student.role !== 'student') return res.status(400).json({ message: 'Можна запрошувати лише студентів.' });

        // --- НОВА ПЕРЕВІРКА 1: Чи студент ВЖЕ НА КУРСІ? ---
        const course = await Course.findById(courseId);
        if (!course) return res.status(404).json({ message: 'Курс не знайдено.' });
        
        if (course.allowedStudents && course.allowedStudents.includes(student._id)) {
             return res.status(400).json({ message: 'Цей студент вже є учасником вашого курсу!' });
        }
        // --------------------------------------------------

        // --- ОНОВЛЕНА ПЕРЕВІРКА 2: Перевіряємо статус інвайтів ---
        // Ми блокуємо відправку, якщо статус 'pending' (вже чекає) 
        // АБО 'accepted' (вже прийняв, але раптом база розсинхронізувалася)
        const existingInvite = await Invitation.findOne({ 
            course: courseId, 
            studentEmail: studentEmail.toLowerCase(), 
            status: { $in: ['pending', 'accepted'] } // Перевіряємо обидва статуси
        });
        
        if (existingInvite) {
            if (existingInvite.status === 'pending') {
                return res.status(400).json({ message: 'Запит цьому студенту вже надіслано і він очікує відповіді.' });
            } else {
                return res.status(400).json({ message: 'Цей студент вже прийняв запрошення на цей курс.' });
            }
        }
        // ---------------------------------------------------------

        const newInvitation = new Invitation({
            course: courseId,
            teacher: req.user.id, 
            studentEmail: studentEmail.toLowerCase(),
            message: message
        });

        try {
            await sendNotification({
                userId: student._id,
                title: '🎓 Нове запрошення на курс!',
                message: `Викладач запрошує вас приєднатися до курсу "${course.title}".`,
                type: 'info',
                link: '/frontend/student/student.html', // Перекидаємо на головну, де є блок інвайтів
                sendEmail: true // Відправляємо лист!
            });
        } catch (notifErr) {
            console.error("Не вдалося відправити сповіщення студенту:", notifErr);
            // Ми не перериваємо код, якщо сповіщення не відправилось
        }

        await newInvitation.save();
        res.status(201).json({ message: 'Запрошення успішно надіслано!', invitation: newInvitation });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Помилка сервера.' });
    }
});

// 2. Список інвайтів для конкретного курсу
// 2. Список інвайтів для конкретного курсу
router.get('/course/:courseId', auth, async (req, res) => {
    try {
        const invites = await Invitation.find({ course: req.params.courseId }).lean();
        
        const enrichedInvites = await Promise.all(invites.map(async (inv) => {
            if (inv.status === 'accepted') {
                const userData = await User.findOne({ email: inv.studentEmail });
                return { 
                    ...inv, 
                    studentName: userData ? userData.name : "Учень",
                    studentId: userData ? userData._id : null,
                    studentAvatar: userData ? userData.avatar : null // ДОДАЛИ ЦЕЙ РЯДОК
                };
            }
            return inv;
        }));
        
        res.json(enrichedInvites);
    } catch (err) {
        res.status(500).json({ message: 'Помилка завантаження списку.' });
    }
});

// 3. Відкликати (видалити) запрошення
router.delete('/:id', auth, async (req, res) => {
    try {
        const invite = await Invitation.findById(req.params.id);
        
        if (!invite) {
            return res.status(404).json({ message: 'Запрошення не знайдено.' });
        }

        // Перевіряємо, чи саме цей викладач створював інвайт (безпека)
        if (invite.teacher.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Немає прав для відкликання цього запрошення.' });
        }

        await invite.deleteOne(); // Видаляємо з бази
        res.json({ message: 'Запрошення успішно відкликано.' });
    } catch (err) {
        console.error("Помилка видалення інвайту:", err);
        res.status(500).json({ message: 'Помилка сервера при видаленні.' });
    }
});

// 4. Отримати запрошення для поточного студента
router.get('/my-invitations', auth, async (req, res) => {
    try {
        // 1. Спочатку дістаємо повні дані юзера з бази по ID з токена
        const user = await User.findById(req.user.id);
        
        if (!user || !user.email) {
            return res.status(404).json({ message: 'Користувача або його email не знайдено' });
        }

        // 2. Тепер використовуємо email з бази (він там точно є)
        const invites = await Invitation.find({ 
            studentEmail: user.email.toLowerCase(), 
            status: 'pending' 
        })
        .populate('course', 'title image')
        .populate('teacher', 'name email');

        res.json(invites);
    } catch (err) {
        console.error("🔥 Помилка завантаження інвайтів:", err);
        res.status(500).json({ message: 'Помилка сервера' });
    }
});

// 5. Прийняти або відхилити запрошення
// 5. Прийняти або відхилити запрошення
router.post('/handle/:id', auth, async (req, res) => {
    try {
        const { status } = req.body; 
        const invite = await Invitation.findById(req.params.id);

        if (!invite) return res.status(404).json({ message: 'Запрошення не знайдено' });

        const studentId = req.user.id; // ID студента, який зараз натиснув кнопку

        if (status === 'accepted') {
            invite.status = 'accepted';
            await invite.save();

            // 1. Додаємо курс у профіль СТУДЕНТА
            const student = await User.findById(studentId);
            if (!student.enrolledCourses.includes(invite.course)) {
                student.enrolledCourses.push(invite.course);
                await student.save();
            }

            // 2. Додаємо студента в список КУРСУ
            const course = await Course.findById(invite.course);
            if (course && !course.allowedStudents.includes(studentId)) {
                course.allowedStudents.push(studentId);
                await course.save();
            }

            // =========================================
            // 🔥 CRM СПОВІЩЕННЯ: ЗАПРОШЕННЯ ПРИЙНЯТО
            // =========================================
            try {
                if (course) {
                    const teacherId = course.author || course.teacher; 
                    
                    if (teacherId) {
                        // ДОДАЄМО &student=${studentId} до посилання
                        const notifLink = `/frontend/teacher/teacher-course-edit.html?id=${course._id}&student=${studentId}`;
                        
                        const studentIdentifier = student.name || invite.studentEmail; 
                        const detailedMessage = `Студент <b>${studentIdentifier}</b> прийняв(ла) ваше запрошення та приєднався до курсу.<br>
                            <b class="text-dark">Курс:</b> ${course.title} 🎉`;

                        // 1. Запис у БД
                        await sendNotification({
                            userId: teacherId,
                            title: 'Новий студент! 🥳',
                            message: detailedMessage,
                            type: 'success',
                            link: notifLink
                        });

                        // 2. Миттєве Socket-сповіщення
                        const io = req.app.get('io') || req.app.get('socketio');
                        if (io) {
                            io.to(teacherId.toString()).emit('new_notification', {
                                title: 'Новий студент! 🥳',
                                message: detailedMessage,
                                link: notifLink
                            });
                        }
                    }
                }
            } catch (notifErr) {
                console.error("Помилка відправки сповіщення про прийняття:", notifErr);
            }

            res.json({ message: 'Вітаємо! Ви успішно приєдналися до курсу.' });

        } else {
            // ЛОГІКА ДЛЯ ВІДХИЛЕННЯ
            invite.status = 'rejected';
            await invite.save();
            
            try {
                const courseDoc = await Course.findById(invite.course);
                if (courseDoc) {
                    const teacherId = courseDoc.author || courseDoc.teacher;
                    // ... у блоці else (rejected) ...
                    if (teacherId) {
                        // Додаємо &view=rejected, щоб фронтенд знав, куди скролити
                        const notifLink = `/frontend/teacher/teacher-course-edit.html?id=${courseDoc._id}&view=rejected`;
                        
                        const studentIdentifier = invite.studentEmail || "Користувач";
                        const detailedMessage = `На жаль, <b>${studentIdentifier}</b> відхилив(ла) запрошення на навчання.<br>
                            <b class="text-dark">Курс:</b> ${courseDoc.title}`;

                        await sendNotification({
                            userId: teacherId,
                            title: 'Запрошення відхилено ❌',
                            message: detailedMessage,
                            type: 'error',
                            link: notifLink
                        });

                        const io = req.app.get('io') || req.app.get('socketio');
                        if (io) {
                            io.to(teacherId.toString()).emit('new_notification', {
                                title: 'Запрошення відхилено ❌',
                                message: detailedMessage,
                                link: notifLink
                            });
                        }
                    }
                }
            } catch (notifErr) {
                console.error("Помилка відправки сповіщення про відхилення:", notifErr);
            }

            res.json({ message: 'Запрошення відхилено.' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Помилка сервера' });
    }
});

module.exports = router;