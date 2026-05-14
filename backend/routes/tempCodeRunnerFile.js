const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');

const frontendURL = "https://chubby-pots-reply.loca.lt"

// === Налаштування nodemailer ===
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: 'lexoraengcourses@gmail.com', // твій email
    pass: process.env.EMAIL_PASS      // пароль/додаток від Google
  }
});

// --- Регістрація ---
router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'Користувач вже існує' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const emailToken = crypto.randomBytes(32).toString('hex');

    // --- Відправка листа ---
    const mailOptions = {
      from: 'lexoraengcourses@gmail.com',
      to: email,
      subject: 'Підтвердіть ваш email',
      html: `<p>Привіт, ${name}! Щоб підтвердити акаунт, натисніть <a href="${frontendURL}/verify.html?token=${emailToken}">тут</a></p>`
    };

    await transporter.sendMail(mailOptions);

    // --- Створюємо користувача після успішної відправки листа ---
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      verified: false,
      emailToken
    });

    await newUser.save();

    res.status(201).json({ message: 'Користувач створений! Перевірте пошту для підтвердження.' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Помилка сервера або не вдалось надіслати лист' });
  }
});


// --- Підтвердження email ---
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  const user = await User.findOne({ emailToken: token });

  if (!user) return res.status(400).send('Невірний токен або користувач не знайдений');

  user.verified = true;
  user.emailToken = null;
  await user.save();

  res.send('Email підтверджено! Тепер ви можете увійти.');
});

// --- Логін ---
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'Користувач не знайдений' });

    if (!user.verified) return res.status(400).json({ message: 'Будь ласка, підтвердіть email перед входом' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Неправильний пароль' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({ token, name: user.name, email: user.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
});

module.exports = router;
