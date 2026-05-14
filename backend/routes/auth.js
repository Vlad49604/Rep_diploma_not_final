const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth'); // ПЕРЕНЕСЕНО НАГОРУ
const parser = require('./cloudinary_upload'); // Твій Cloudinary парсер
const sendNotification = require('../utils/notifier'); // Переконайся, що шлях правильний

// === НАЛАШТУВАННЯ АДРЕСИ ===
const BASE_URL = "https://unschooled-isothermally-aleen.ngrok-free.dev";

// === НАЛАШТУВАННЯ NODEMAILER ===
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: 'lexoraengcourses@gmail.com',
    pass: process.env.EMAIL_PASS
  }
});

// === РОУТ ДЛЯ ЗАВАНТАЖЕННЯ АВАТАРА (Cloudinary) ===
// Використовуємо 'image', бо так шле фронтенд у FormData
router.post('/upload-avatar', auth, parser.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Файл не обрано" });

    const avatarUrl = req.file.path; // URL від Cloudinary
    
    await User.findByIdAndUpdate(req.user.id, { avatar: avatarUrl });
    
    res.json({ message: "Аватар оновлено", avatarUrl });
  } catch (err) {
    console.error("Помилка завантаження аватара:", err);
    res.status(500).json({ message: "Помилка при завантаженні" });
  }
} );

// === РЕЄСТРАЦІЯ (SIGNUP) ===
router.post('/signup', async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'Користувач вже існує' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const emailToken = crypto.randomBytes(32).toString('hex');
    const verificationUrl = `${BASE_URL}/api/auth/verify-email?token=${emailToken}`;

    const mailOptions = {
      from: '"Lexora Team" <lexoraengcourses@gmail.com>',
      to: email,
      subject: 'Підтвердьте вашу реєстрацію в Lexora 🌿',
      html: `
        <div style="background-color: #f4f7f6; padding: 40px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; shadow: 0 4px 15px rgba(0,0,0,0.1);">
            
            <div style="background-color: #4dbf73; padding: 30px; text-align: center; color: white;">
              <h1 style="margin: 0; font-size: 32px; letter-spacing: 2px;">LEXORA</h1>
              <p style="margin: 5px 0 0; opacity: 0.9;">English Learning Platform</p>
            </div>

            <div style="padding: 40px; text-align: center;">
              <h2 style="color: #2c3e50; margin-bottom: 20px;">Привіт, ${name}!</h2>
              <p style="font-size: 16px; line-height: 1.6; color: #555; margin-bottom: 30px;">
                Дякуємо за реєстрацію в <strong>Lexora</strong>. Ми створюємо найкращі умови для вивчення англійської мови! 
                Будь ласка, натисніть на кнопку нижче, щоб активувати ваш акаунт.
              </p>
              
              <a href="${verificationUrl}" style="display: inline-block; background-color: #4dbf73; color: white; padding: 15px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px; transition: background-color 0.3s ease;">
                Підтвердити акаунт
              </a>
              
              <p style="margin-top: 30px; font-size: 12px; color: #999;">
                Якщо ви не реєструвалися на нашому сайті, просто ігноруйте цей лист.
              </p>
            </div>

            <div style="background-color: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #aaa; border-top: 1px solid #eee;">
              &copy; 2026 Lexora Team. м. Львів, вул. Наукова 30.
            </div>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    const newUser = new User({
      name, email, password: hashedPassword, verified: false, emailToken, role: role || "student"
    });

    await newUser.save();
    res.status(201).json({ message: 'Лист надіслано!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Помилка сервера при реєстрації' });
  }
});

// === ПІДТВЕРДЖЕННЯ EMAIL ===
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    const user = await User.findOne({ emailToken: token });
    if (!user) return res.redirect(`${BASE_URL}/verify.html?status=error`);

    user.verified = true;
    user.emailToken = null;
    await user.save();
    res.redirect(`${BASE_URL}/verify.html?status=success`);
  } catch (err) {
    res.redirect(`${BASE_URL}/verify.html?status=error`);
  }
});

// === ВХІД (LOGIN) ===
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'Користувач не знайдений' });
    if (!user.verified) return res.status(400).json({ message: 'Будь ласка, підтвердіть email' });

    // 1. ПЕРЕВІРКА БЛОКУВАННЯ (Через невдалі спроби входу)
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const remainingMinutes = Math.ceil((user.lockUntil - Date.now()) / (60 * 1000));
      return res.status(403).json({ 
        message: `Акаунт тимчасово заблоковано через велику кількість помилок. Спробуйте через ${remainingMinutes} хв.` 
      });
    }

    // 2. ПЕРЕВІРКА ПАРОЛЯ
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      // Збільшуємо кількість спроб
      user.loginAttempts = (user.loginAttempts || 0) + 1;

      // Якщо це 5-та помилка — блокуємо на 15 хвилин
      if (user.loginAttempts >= 5) {
        user.lockUntil = Date.now() + 15 * 60 * 1000; // Поточний час + 15 хвилин
        await user.save();

        // 🛡️ СПОВІЩЕННЯ АДМІНІВ (Тільки при досягненні ліміту)
        const admins = await User.find({ role: 'admin' });
        for (const admin of admins) {
          await sendNotification({
            userId: admin._id,
            title: '🚨 Акаунт заблоковано',
            message: `Акаунт <b>${email}</b> було автоматично заблоковано на 15 хвилин після 5 невдалих спроб входу.`,
            type: 'error',
            link: '#', 
            sendEmail: true,
            saveToDb: true
          });
        }

        return res.status(403).json({ 
          message: 'Забагато невдалих спроб. Акаунт заблоковано на 15 хвилин.' 
        });
      }

      await user.save();
      return res.status(400).json({ message: 'Неправильний пароль' });
    }
    
    // ==========================================
    // 🔥 НОВИЙ БЛОК: ПЕРЕВІРКА НА БАН ВІД АДМІНА
    // ==========================================
    if (user.isBanned) {
      // Перевіряємо, чи час бану вже вийшов (якщо бан був тимчасовий)
      if (user.bannedUntil && user.bannedUntil < new Date()) {
          // Час вийшов! Автоматичний розбан
          user.isBanned = false;
          user.banReason = '';
          user.bannedUntil = null;
          // Дозволяємо коду йти далі до успішного входу
      } else {
          // Бан ще діє (або він назавжди)
          const timeMsg = user.bannedUntil 
              ? `до ${new Date(user.bannedUntil).toLocaleString('uk-UA')}` 
              : 'НАЗАВЖДИ';
          return res.status(403).json({ 
              message: `Акаунт заблоковано ${timeMsg}. Причина: ${user.banReason}` 
          });
      }
    }
    // ==========================================

    // 3. УСПІШНИЙ ВХІД
    // Скидаємо всі лічильники та блокування
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    user.lastLogin = new Date(); 
    await user.save();

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar 
    });
  } catch (err) {
    console.error("Помилка логіну:", err);
    res.status(500).json({ message: 'Помилка сервера при вході' });
  }
});

// === ДАНІ ПОТОЧНОГО КОРИСТУВАЧА ===
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'Користувача не знайдено' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Помилка сервера' });
  }
});

// Збереження номера картки викладача
router.put('/update-card', auth, async (req, res) => {
    try {
        const { cardNumber } = req.body;
        await User.findByIdAndUpdate(req.user.id, { cardNumber });
        res.json({ success: true, message: 'Картку оновлено' });
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// === ЗБЕРЕЖЕННЯ / ВИДАЛЕННЯ КАРТКИ СТУДЕНТА (Токенізація) ===
router.put('/update-student-card', auth, async (req, res) => {
    try {
        // Якщо action === 'remove', ми просто очищаємо поля
        if (req.body.action === 'remove') {
            await User.findByIdAndUpdate(req.user.id, { savedCardMask: '', paymentToken: '' });
            return res.json({ success: true, message: 'Картку видалено' });
        }

        // Інакше - зберігаємо нові дані
        const { savedCardMask, paymentToken } = req.body;
        await User.findByIdAndUpdate(req.user.id, { savedCardMask, paymentToken });
        res.json({ success: true, message: 'Картку успішно збережено' });
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера при збереженні картки' });
    }
});

// === ОНОВЛЕННЯ ПРОФІЛЮ (ІМ'Я) ===
router.put('/:id', auth, async (req, res) => {
  try {
    const userId = req.params.id;
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "Ім'я порожнє" });
    if (req.user.id !== userId) return res.status(403).json({ message: "Немає доступу" });

    const updatedUser = await User.findByIdAndUpdate(userId, { name }, { new: true }).select('-password');
    res.status(200).json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: "Помилка оновлення" });
  }
});

// === ЗМІНА ПАРОЛЯ (Change Password) ===
router.post('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // 1. Шукаємо користувача (ID беремо з токена через мідлвар auth)
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "Користувача не знайдено" });

    // 2. Перевіряємо, чи правильний поточний пароль
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Поточний пароль введено невірно" });
    }

    // 3. Хешуємо новий пароль
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    // 4. Зберігаємо в базі
    await user.save();

    res.json({ message: "Пароль успішно змінено!" });
  } catch (err) {
    console.error("Password change error:", err);
    res.status(500).json({ message: "Помилка сервера при зміні пароля" });
  }
});

// === ВИДАЛЕННЯ АКАУНТУ ===
router.delete('/:id', auth, async (req, res) => {
  try {
    const userId = req.params.id;

    // Перевірка, чи юзер видаляє саме себе, а не когось іншого
    if (req.user.id !== userId) {
      return res.status(403).json({ message: "У вас немає прав для видалення цього акаунту" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Користувача не знайдено" });
    }

    // Видаляємо користувача
    await User.findByIdAndDelete(userId);

    res.status(200).json({ message: "Акаунт успішно видалено" });
  } catch (error) {
    console.error("Помилка видалення акаунта:", error);
    res.status(500).json({ message: "Помилка сервера при видаленні акаунта" });
  }
});

// === ПЕРЕВІРКА НАЯВНОСТІ EMAIL ===
// === ПЕРЕВІРКА EMAIL (щоб не було 404) ===
router.get('/check-email', async (req, res) => {
  try {
    const { email } = req.query;
    const user = await User.findOne({ email });
    res.json({ exists: !!user });
  } catch (err) {
    res.status(500).json({ message: "Помилка перевірки" });
  }
});

// Отримати курси, на які підписаний студент
// === Отримання курсів студента (для кешування) ===
router.get('/student/my-courses', auth, async (req, res) => {
  try {
    // Шукаємо юзера і завантажуємо дані його курсів
    const user = await User.findById(req.user.id).populate('enrolledCourses');
    if (!user) return res.status(404).json({ message: "Юзера не знайдено" });
    
    res.json(user.enrolledCourses || []);
  } catch (err) {
    res.status(500).json({ message: "Помилка завантаження курсів" });
  }
});

// Збереження номера картки викладача
router.put('/update-card', auth, async (req, res) => {
    try {
        const { cardNumber } = req.body;
        await User.findByIdAndUpdate(req.user.id, { cardNumber });
        res.json({ success: true, message: 'Картку оновлено' });
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

module.exports = router;