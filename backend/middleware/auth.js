const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  // 1. Шукаємо токен у заголовку Authorization
  const authHeader = req.header('Authorization');

  // Якщо заголовка немає — доступ закритий
  if (!authHeader) {
    return res.status(401).json({ message: 'Немає токена, доступ заборонено' });
  }

  // Зазвичай токен приходить у форматі "Bearer <token>"
  // Тому ми розділяємо рядок пробілом і беремо саме токен
  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Формат токена неправильний, доступ заборонено' });
  }

  try {
    // 2. Перевіряємо токен за допомогою секретного ключа з твого .env
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Додаємо дані користувача (id та role) прямо в запит (req.user)
    // Тепер у будь-якому роуті ти зможеш написати req.user.id
    req.user = decoded;

    // 4. Пропускаємо запит далі до основного коду роута
    next();
  } catch (err) {
    console.error("🚨 Помилка авторизації:", err.message);
    res.status(401).json({ message: 'Токен невалідний або застарів' });
  }
};