const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Course = require('../models/CourseModel'); // АБО Course (перевір свою назву)
const auth = require('../middleware/auth');
const nodemailer = require('nodemailer');

// 1. Отримання списку курсів викладача (для випадаючого списку в розсилці)
router.get('/my-courses-list', auth, async (req, res) => {
    try {
        if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Доступ заборонено' });
        const courses = await Course.find({ author: req.user.id }).select('title _id');
        res.json(courses);
    } catch (err) {
        res.status(500).json({ error: 'Помилка завантаження курсів' });
    }
});

// 2. Отримання списку СВОЇХ студентів з РОЗШИРЕНОЮ фільтрацією
router.get('/my-students', auth, async (req, res) => {
    try {
        if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Доступ заборонено' });

        const { condition, days, courseId } = req.query;

        // КРОК 1: Збираємо ID курсів (або всі, або один конкретний)
        let targetCourseIds = [];
        if (courseId && courseId !== 'all') {
            // Перевіряємо, чи цей курс дійсно належить цьому викладачу
            const course = await Course.findOne({ _id: courseId, author: req.user.id });
            if (course) targetCourseIds.push(course._id);
        } else {
            // Якщо курс не обрано, беремо всі курси викладача
            const myCourses = await Course.find({ author: req.user.id }).select('_id');
            targetCourseIds = myCourses.map(c => c._id);
        }

        if (targetCourseIds.length === 0) return res.json({ users: [] });

        // КРОК 2: Дістаємо всіх студентів, які є на цих курсах
        const coursesWithStudents = await Course.find({ _id: { $in: targetCourseIds } }).select('allowedStudents');
        let studentIds = [];
        coursesWithStudents.forEach(c => {
            if (c.allowedStudents) studentIds.push(...c.allowedStudents);
        });

        if (studentIds.length === 0) return res.json({ users: [] });

        // КРОК 3: Будуємо смарт-фільтр
        // КРОК 3: Будуємо смарт-фільтр БЕЗ XP (на основі наявних даних)
        let filter = { _id: { $in: studentIds } };
        const now = new Date();

        switch (condition) {
            case 'inactive':
                // Не заходили N днів
                const daysAgo = new Date();
                daysAgo.setDate(now.getDate() - parseInt(days || 5));
                filter.lastLogin = { $lte: daysAgo };
                break;
                
            case 'stuck':
                // "Застрягли": зареєструвалися понад 7 днів тому, але масив пройдених курсів порожній
                const weekAgo = new Date();
                weekAgo.setDate(now.getDate() - 7);
                filter.createdAt = { $lte: weekAgo };
                filter.completedCourses = { $size: 0 };
                break;
                
            case 'excellent':
                // "Відмінники": завершили хоча б один курс (масив completedCourses має розмір більше 0)
                filter.completedCourses = { $exists: true, $not: { $size: 0 } };
                break;
                
            case 'all':
            default:
                break; // Без додаткових умов
        }

        const students = await User.find(filter).select('email name avatar xp');
        res.json({ users: students });

    } catch (err) {
        console.error("Teacher CRM Error:", err);
        res.status(500).json({ error: 'Помилка завантаження бази студентів' });
    }
});

// 3. Масова розсилка з ПЕРСОНАЛІЗОВАНИМ ШАБЛОНОМ ВЧИТЕЛЯ
router.post('/bulk-mail', auth, async (req, res) => {
    try {
        if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Доступ заборонено' });

        const { emails, subject, body, imageUrl } = req.body;
        
        // Знаходимо викладача, щоб взяти ім'я та аватар
        const teacher = await User.findById(req.user.id);
        const teacherName = teacher.name || 'Викладач Lexora';
        const firstLetter = teacherName.charAt(0).toUpperCase();

        // СТВОРЮЄМО ДИНАМІЧНИЙ АВАТАР ДЛЯ ЛИСТА
        const avatarHtml = teacher.avatar 
            ? `<img src="${teacher.avatar}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 2px solid #198754; display: block;">`
            : `<div style="width: 50px; height: 50px; border-radius: 50%; background-color: #198754; color: #ffffff; text-align: center; line-height: 50px; font-size: 24px; font-weight: bold; font-family: Arial, sans-serif;">${firstLetter}</div>`;

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
        });

        const htmlTemplate = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #eef2f3; border-radius: 20px; overflow: hidden;">
                <div style="background: #f4fdf6; padding: 25px; border-bottom: 1px solid #e8f5e9;">
                    <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                        <tr>
                            <td style="width: 60px;">${avatarHtml}</td>
                            <td style="padding-left: 15px;">
                                <h3 style="margin: 0; color: #2d3436; font-size: 17px;">${teacherName}</h3>
                                <p style="margin: 0; color: #198754; font-size: 12px; font-weight: bold;">Ваш ментор на Lexora</p>
                            </td>
                        </tr>
                    </table>
                </div>

                ${imageUrl ? `<img src="${imageUrl}" style="width: 100%; max-height: 280px; object-fit: cover;" alt="Banner">` : ''}

                <div style="padding: 35px; color: #2d3436; line-height: 1.7; font-size: 16px;">
                    ${body.replace(/\n/g, '<br>')}
                    <div style="margin-top: 30px; text-align: center;">
                        <a href="http://127.0.0.1:5501/frontend/index.html" style="background-color: #198754; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 50px; font-weight: bold; display: inline-block;">Продовжити навчання</a>
                    </div>
                </div>
                <div style="background-color: #f8f9fa; padding: 15px; text-align: center; color: #b2bec3; font-size: 11px;">
                    <p>Це персональне повідомлення від викладача курсу Lexora English.</p>
                </div>
            </div>
        `;

        await transporter.sendMail({
            from: `"${teacherName} (Lexora)" <${process.env.EMAIL_USER}>`,
            bcc: emails,
            subject: subject,
            html: htmlTemplate
        });

        res.json({ success: true, sentCount: emails.length });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Помилка розсилки' });
    }
});

// backend/routes/teacher.js


// РОУТ ПОШУКУ СТУДЕНТІВ ДЛЯ ВИКЛАДАЧА
router.get('/search-students', auth, async (req, res) => {
    // Перевіряємо, чи це вчитель
    if (req.user.role !== 'teacher') {
        return res.status(403).json({ error: 'Доступ дозволено лише викладачам' });
    }

    try {
        const query = req.query.q;
        if (!query) return res.json({ users: [] });

        // Шукаємо ТІЛЬКИ тих, у кого role: 'student'
        const students = await User.find({
            role: 'student',
            $or: [
                { name: { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } }
            ]
        }).limit(10).select('name email');

        res.json({ users: students });
    } catch (err) {
        console.error("Помилка пошуку студентів:", err);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});


module.exports = router;