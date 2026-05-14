const express = require('express');
const parser = require('./cloudinary_upload'); // твій multer/cloudinary
const cloudinary = require('./cloudinaryConfig');

const router = express.Router();

// Функція для отримання public_id з URL-адреси
function getPublicIdFromUrl(url) {
  const parts = url.split('/');
  const fileWithExt = parts.pop().split('?')[0];
  const filename = fileWithExt.split('.')[0];
  const folderIndex = parts.findIndex(p => p === 'uploads');
  const folderPath = parts.slice(folderIndex).join('/');
  return `${folderPath}/${filename}`;
}

// Завантаження картинки
router.post('/', parser.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не обрано' });
  res.json({ url: req.file.path });
});

// Видалення картинки
router.delete('/', async (req, res) => {
  const imageUrl = req.body.url;
  if (!imageUrl) return res.status(400).json({ error: 'URL не вказано' });

  try {
    const publicId = getPublicIdFromUrl(imageUrl);
    const result = await cloudinary.uploader.destroy(publicId);
    res.json({ message: 'Картинку успішно видалено', result });
  } catch (err) {
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

module.exports = router;
