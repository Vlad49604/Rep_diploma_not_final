const express = require('express');
const router = express.Router();
const Course = require('../models/CourseModel');
const mongoose = require('mongoose');
const auth = require('../middleware/auth'); // Імпортуємо наш "щит"
const User = require('../models/User'); // Модель юзера для запису в базу
const Invitation = require('../models/Invitation');
const Result = require('../models/Result');
const Draft = require('../models/Draft');

// --- Перевірка валідності ObjectId ---
function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}


function isValidObjectId(id) {
  return /^[0-9a-fA-F]{24}$/.test(id);
}


// ==========================
// ====== Курси ============
// ==========================

// Додати новий курс
// Додати новий курс
router.post('/add', async (req, res) => {
  try {
    // Витягуємо ВСІ можливі поля, включаючи нові
    const { 
      title, 
      description, 
      image, 
      author, 
      authorRole, 
      isSystem, 
      isPublic,
      price
    } = req.body;

    // Формуємо об'єкт курсу
    const course = new Course({
      title,
      description,
      image: image || null,
      author: author || null, // Може бути null для старих адмінських курсів
      
      // Якщо фронтенд передав ці поля - беремо їх. 
      // Якщо ні (наприклад, стара адмінка) - використовуємо дефолти
      authorRole: authorRole !== undefined ? authorRole : 'admin',
      isSystem: isSystem !== undefined ? isSystem : true,
      isPublic: isPublic !== undefined ? isPublic : true, // Або false, залежно як ти хочеш для адмінки
      price: price || 0,
      sections: []
    });

    await course.save();
    res.status(201).json({ message: 'Курс створено!', course });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера при створенні курсу' });
  }
});

// Отримати всі курси
router.get('/', async (req, res) => {
  try {
    const courses = await Course.find();
    res.json(courses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера при отриманні курсів' });
  }
});

// 1. Отримати всі курси (Ставимо вище, щоб не було конфліктів з ID)
router.get('/all', async (req, res) => {
  try {
    const courses = await Course.aggregate([
      {
        $project: {
          title: 1, description: 1, image: 1, level: 1, isPublic: 1,
          totalSections: { $size: { $ifNull: ["$sections", []] } },price: 1
        }
      }
    ]);
    res.json(courses);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Отримати курси, створені саме цим викладачем
router.get('/my-courses', auth, async (req, res) => {
  try {
    // Шукаємо курси, де author дорівнює ID юзера з токена
    const courses = await Course.find({ author: req.user.id });
    res.json(courses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Створення курсу викладачем
router.post('/teacher-create', auth, async (req, res) => {
  try {
    const newCourse = new Course({
      ...req.body,
      author: req.user.id,        // Прив'язуємо до викладача
      authorRole: 'teacher',      // Фіксуємо роль
      isSystem: false,            // Це приватний курс, не системний
      isPublic: false             // Поки що не публікуємо для всіх
    });
    const savedCourse = await newCourse.save();
    res.status(201).json(savedCourse);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Видалити курс
router.delete('/:courseId', async (req, res) => {
  const { courseId } = req.params;
  if (!isValidId(courseId)) return res.status(400).json({ error: 'Некоректний courseId' });

  try {
    await Course.findByIdAndDelete(courseId);
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Оновити курс
router.put('/:courseId', async (req, res) => {
  const { courseId } = req.params;
  if (!isValidId(courseId)) return res.status(400).json({ error: 'Некоректний ID курсу' });

  // 1. Додали isPublic у деструктуризацію
  const { title, description, image, isPublic, price } = req.body;

  try {
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ error: 'Курс не знайдено' });

    if (title) course.title = title;
    if (description) course.description = description;
    if (image !== undefined) course.image = image;

    if (price !== undefined) course.price = price;

    // 2. Правильно перевіряємо булеве значення
    if (typeof isPublic === 'boolean') {
      course.isPublic = isPublic;
    }

    await course.save();
    res.json(course);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка при оновленні курсу' });
  }
});

// ==========================
// ====== Секції ============
// ==========================

// Додати секцію до курсу
// router.post('/:courseId/section', async (req, res) => {
//   const { courseId } = req.params;
//   if (!isValidId(courseId)) return res.status(400).json({ error: 'Некоректний courseId' });

//   try {
//     const { title, description, image } = req.body; // тепер беремо image
//     const course = await Course.findById(courseId);
//     if (!course) return res.status(404).json({ error: 'Курс не знайдено' });

//     course.sections.push({ title, description, image, tasks: [] }); // додаємо image

//     await course.save();
//     res.json({ message: 'Секцію додано', course });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Помилка сервера при додаванні секції' });
//   }
// });


router.post('/:courseId/section', async (req, res) => {
  const { courseId } = req.params;
  console.log("POST /:courseId/section, params:", req.params);
  console.log("POST /:courseId/section, body:", req.body);

  if (!isValidId(courseId)) return res.status(400).json({ error: 'Некоректний courseId' });

  try {
    const { title, description, image } = req.body;

    // Перевірка обов'язкового поля title
    if (!title || title.trim() === "") {
      return res.status(400).json({ error: "Назва секції обов'язкова" });
    }

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ error: 'Курс не знайдено' });

    // Додаємо секцію, перевіряємо, щоб image був рядком або пустим
    course.sections.push({
      title: title.trim(),
      description: description ? description.trim() : "",
      image: image ? image.trim() : "",
      tasks: []
    });

    console.log("sections перед save():", course.sections);

    await course.save();

    console.log("Секція успішно додана");
    res.json({ message: 'Секцію додано', course });

  } catch (err) {
    console.error("Помилка при додаванні секції:", err);
    res.status(500).json({ error: 'Помилка сервера при додаванні секції', details: err.message });
  }
});


// Отримати всі секції конкретного курсу
router.get('/:courseId/sections', async (req, res) => {
  const { courseId } = req.params;
  if (!isValidId(courseId)) return res.status(400).json({ error: 'Некоректний courseId' });

  try {
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ error: 'Курс не знайдено' });

    res.json(course.sections || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера при отриманні секцій' });
  }
});

// Оновити секцію
router.put('/:courseId/section/:sectionId', async (req, res) => {
  const { courseId, sectionId } = req.params;
  console.log('req.body:', req.body);

  if (!isValidId(courseId) || !isValidId(sectionId)) {
    return res.status(400).json({ error: 'Некоректний ID курсу або секції' });
  }

  const { title, description, image } = req.body;

  try {
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ error: 'Курс не знайдено' });

    const section = course.sections.id(sectionId);
    if (!section) return res.status(404).json({ error: 'Секцію не знайдено' });

    if (title !== undefined) section.title = title.trim();
    if (description !== undefined) section.description = description.trim();
    if (image !== undefined) section.image = image;

    // Важливо: примусово позначаємо підмасив як змінений
    section.markModified('image');

    console.log('Секція перед save():', section);

    await course.save();

    const updatedSection = course.sections.id(sectionId);
    res.json({ message: 'Секцію оновлено', section: updatedSection });

  } catch (err) {
    console.error('Помилка при оновленні секції:', err);
    res.status(500).json({ error: 'Помилка сервера при оновленні секції', details: err.message });
  }
});





// Видалити секцію
router.delete('/:courseId/section/:sectionId', async (req, res) => {
  const { courseId, sectionId } = req.params;
  if (!isValidId(courseId) || !isValidId(sectionId)) return res.status(400).json({ error: 'Некоректний ID' });

  try {
    await Course.updateOne(
      { _id: courseId },
      { $pull: { sections: { _id: sectionId } } }
    );
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================
// ====== Завдання ===========
// ==========================

// --- Додавання завдання ---
// ====== Додавання нового завдання до секції ======
router.post('/:courseId/section/:sectionId/task', async (req, res) => {
  const { courseId, sectionId } = req.params;

  // Логування для відладки — допоможе побачити, що реально прийшло з фронта
  console.log(`Додавання завдання до курсу ${courseId}, секції ${sectionId}`);
  console.log("Дані з req.body:", req.body);

  // 1. Перевірка валідності ID
  if (!isValidId(courseId) || !isValidId(sectionId)) {
    return res.status(400).json({ error: "Некоректний ID курсу або секції" });
  }

  try {
    // 2. Витягуємо ВСІ поля з req.body
    const { 
      title, 
      description, 
      taskType, 
      image,
      options,      // для multiple choice
      explanation,  // пояснення помилок
      gapText,      // для вставки слів
      gapAnswer,    // відповідь для вставки
      pairs         // для matching
    } = req.body;

    // 3. Валідація обов'язкових полів
    if (!title || title.trim() === "") {
      return res.status(400).json({ error: "Назва завдання обов'язкова" });
    }
    if (!taskType || taskType.trim() === "") {
      return res.status(400).json({ error: "Тип завдання обов'язковий" });
    }

    // 4. Пошук курсу та секції
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ error: "Курс не знайдено" });

    const section = course.sections.id(sectionId);
    if (!section) return res.status(404).json({ error: "Секцію не знайдено" });

    // 5. Створення об'єкта завдання зі збереженням структури
    const newTask = {
      title: title.trim(),
      description: description ? description.trim() : "",
      taskType: taskType.trim(),
      image: image ? image.trim() : "",
      explanation: explanation || "",
      // Записуємо специфічні поля (якщо їх немає в body, будуть порожні значення/масиви)
      options: Array.isArray(options) ? options : [],
      pairs: Array.isArray(pairs) ? pairs : [],
      gapText: gapText || "",
      gapAnswer: gapAnswer || ""
    };

    // 6. Додаємо в масив та зберігаємо
    section.tasks.push(newTask);
    
    // Примусово позначаємо поле як змінене, щоб Mongoose точно оновив вкладений документ
    section.markModified('tasks');

    await course.save();

    console.log("Завдання успішно додано з усіма даними");
    res.json({ message: "Завдання успішно створено", course });

  } catch (err) {
    console.error("Помилка на сервері:", err);
    res.status(500).json({ 
      error: "Помилка сервера при додаванні завдання", 
      details: err.message 
    });
  }
});


// ====== Оновлення завдання ======
router.put('/:courseId/section/:sectionId/task/:taskId', async (req, res) => {
  const { courseId, sectionId, taskId } = req.params;

  if (!isValidId(courseId) || !isValidId(sectionId) || !isValidId(taskId)) {
    return res.status(400).json({ error: 'Некоректний ID' });
  }

  const {
    title,
    description,
    taskType,
    options,
    explanation,
    gapText,
    gapAnswer,
    pairs,
    image,
    audio
  } = req.body;

  try {
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ error: 'Курс не знайдено' });

    const section = course.sections.id(sectionId);
    if (!section) return res.status(404).json({ error: 'Секцію не знайдено' });

    const task = section.tasks.id(taskId);
    if (!task) return res.status(404).json({ error: 'Завдання не знайдено' });

    // --- Основні поля ---
    if (title !== undefined) task.title = title.trim();
    if (description !== undefined) task.description = description.trim();
    if (taskType !== undefined) task.taskType = taskType;
    if (image !== undefined) task.image = image;
    if (audio !== undefined) task.audio = audio;

    // --- Очистка та оновлення полів в залежності від типу завдання ---
    switch (taskType) {
      case 'multiple':
        task.options = Array.isArray(options) ? options.map(opt => ({
          text: opt.text || '',
          isCorrect: !!opt.isCorrect
        })) : [];
        task.gapText = '';
        task.gapAnswer = '';
        task.pairs = [];
        task.explanation = explanation || '';
        break;

      case 'gap':
        task.options = [];
        task.pairs = [];
        task.gapText = gapText || '';
        task.gapAnswer = gapAnswer || '';
        task.explanation = explanation || '';
        break;

      case 'matching':
        task.options = [];
        task.gapText = '';
        task.gapAnswer = '';
        task.pairs = Array.isArray(pairs) ? pairs.map(p => ({
          left: p.left || '',
          right: p.right || ''
        })) : [];
        task.explanation = explanation || '';
        break;

      case 'essay':
        task.options = [];
        task.gapText = '';
        task.gapAnswer = '';
        task.pairs = [];
        task.explanation = explanation || '';
        break;

      default:
        // Якщо невідомий тип — нічого не робимо
        break;
    }

    // --- Позначаємо зміни для Mongoose ---
    section.markModified('tasks');

    await course.save();

    const updatedTask = section.tasks.id(taskId);
    res.json({ message: 'Завдання оновлено', task: updatedTask });

  } catch (err) {
    console.error('Помилка при оновленні завдання:', err);
    res.status(500).json({ error: 'Помилка сервера при оновленні завдання', details: err.message });
  }
});

// ==========================
// ====== Видалення завдання ======

// ====== Видалення завдання (Атомний метод, як у секції) ======
router.delete('/:courseId/section/:sectionId/task/:taskId', async (req, res) => {
  const { courseId, sectionId, taskId } = req.params;

  if (!isValidId(courseId) || !isValidId(sectionId) || !isValidId(taskId)) {
    return res.status(400).json({ error: 'Некоректний ID' });
  }

  try {
    // Використовуємо такий самий підхід, як ти зробив для секцій:
    // Звертаємось до бази напряму через updateOne та $pull
    const result = await Course.updateOne(
      { 
        _id: courseId, 
        "sections._id": sectionId // Знаходимо потрібну секцію в курсі
      },
      { 
        // Оператор $pull видаляє елемент з масиву tasks, який належить цій секції
        $pull: { "sections.$.tasks": { _id: taskId } } 
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ error: 'Завдання не знайдено' });
    }

    console.log(`Завдання ${taskId} видалено так само, як ти видаляєш секції`);
    res.json({ message: 'Завдання видалено' });

  } catch (err) {
    console.error('Помилка при видаленні завдання:', err);
    res.status(500).json({ error: err.message });
  }
});


// ==========================
// ====== Для Студента ======
// ==========================

// 1. Отримати всі курси (Ставимо вище, щоб не було конфліктів з ID)
router.get('/enrolled', auth, async (req, res) => {
    try {
        // Знаходимо юзера за токеном
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'Користувача не знайдено' });

        // Якщо масив порожній або його немає
        if (!user.enrolledCourses || user.enrolledCourses.length === 0) {
            return res.json([]);
        }

        // Шукаємо курси, ID яких є в масиві enrolledCourses студента
        // Витягуємо лише _id та title, щоб не грузити базу зайвими даними (наприклад картинками)
        const courses = await Course.find({ 
            _id: { $in: user.enrolledCourses } 
        }).select('_id title sections isSystem isPublic price'); 

        res.json(courses);
    } catch (err) {
        console.error("Помилка отримання записаних курсів:", err);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// Отримати список усіх студентів, що підписані на курс (enrolled)
router.get('/:id/students', auth, async (req, res) => {
    try {
        const User = require('../models/User'); 
        // Шукаємо юзерів, у яких в масиві enrolledCourses є цей courseId
        const students = await User.find({ enrolledCourses: req.params.id })
                                   .select('name email avatar');
        res.json(students);
    } catch (err) {
        res.status(500).json({ error: "Помилка завантаження списку студентів" });
    }
});

// 2. Записатися на курс
// === ЗАПИС НА КУРС (ENROLL) ===
// === ЗАПИС НА КУРС (ENROLL) ===
router.post('/enroll', auth, async (req, res) => {
    try {
        const { courseId } = req.body;
        
        // 1. Знаходимо студента (юзера)
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'Користувач не знайдений' });

        // 2. Знаходимо КУРС, щоб дізнатися ID викладача (author)
        const course = await Course.findById(courseId);
        if (!course) return res.status(404).json({ message: 'Курс не знайдено' });

        // 3. Ініціалізуємо масив курсів студента, якщо його немає
        if (!user.enrolledCourses) {
            user.enrolledCourses = [];
        }

        // 4. Перевірка на дублікат (чи вже записаний)
        if (user.enrolledCourses.includes(courseId)) {
            return res.status(400).json({ message: 'Ви вже записані на цей курс!' });
        }

        // 5. Додаємо курс у профіль студента
        user.enrolledCourses.push(courseId);
        await user.save();

        // ============================================================
        // 🔥 АВТОМАТИЧНА СИНХРОНІЗАЦІЯ З CRM ВЧИТЕЛЯ 🔥
        // ============================================================
        
        const Invitation = require('../models/Invitation'); 

        // Перевіряємо, чи вчитель вже надсилав інвайт раніше
        let invite = await Invitation.findOne({ 
            course: courseId, 
            studentEmail: user.email.toLowerCase() 
        });

        if (invite) {
            // Якщо інвайт був — оновлюємо статус на прийнятий
            invite.status = 'accepted';
            invite.studentId = user._id;
            invite.studentName = user.name;
            // Додаємо вчителя про всяк випадок, якщо його не було
            invite.teacher = course.author; 
            if (user.avatar) invite.studentAvatar = user.avatar;
            await invite.save();
        } else {
            // СТВОРЮЄМО НОВИЙ ЗАПИС (Тепер з обов'язковим полем teacher)
            invite = new Invitation({
                course: courseId,
                teacher: course.author, // 🔥 Ось це виправляє вашу помилку!
                studentEmail: user.email.toLowerCase(),
                studentId: user._id,
                studentName: user.name,
                studentAvatar: user.avatar || '',
                status: 'accepted',
                message: 'Самостійно приєднався до публічного курсу 🚀' 
            });
            await invite.save();
        }

        // Додаємо студента до списку дозволених у самому курсі
        await Course.findByIdAndUpdate(courseId, {
            $addToSet: { allowedStudents: user._id }
        });
        // ============================================================

        res.json({ 
            message: 'Успішно записано! Курс додано до вашого кабінету.',
            courseId: courseId 
        });

    } catch (err) {
        console.error("Помилка на сервері при записі на курс:", err);
        res.status(500).json({ 
            error: 'Внутрішня помилка сервера', 
            details: err.message 
        });
    }
});

// 3. Повні дані одного курсу
router.get('/full/:courseId', async (req, res) => {
    try {
        if (!isValidId(req.params.courseId)) return res.status(400).json({ error: 'ID не валідний' });
        const course = await Course.findById(req.params.courseId);
        if (!course) return res.status(404).json({ error: 'Курс не знайдено' });
        res.json(course);
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// Отримати один курс за ID
router.get('/:id', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id).populate('author', 'name email');
    if (!course) return res.status(404).json({ message: 'Курс не знайдено' });
    res.json(course);
  } catch (err) {
    res.status(500).json({ message: 'Помилка сервера' });
  }
});

// Відписка від курсу
router.post('/unsubscribe', async (req, res) => {
    try {
        const { userId, courseId } = req.body;

        if (!userId || !courseId) {
            return res.status(400).json({ message: "Бракує даних (userId або courseId)" });
        }

        // $pull безпечно видаляє конкретний ID з масиву enrolledCourses
        const user = await User.findByIdAndUpdate(
            userId,
            { $pull: { enrolledCourses: courseId } },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ message: "Користувача не знайдено" });
        }

        res.status(200).json({ message: "Успішно відписано від курсу", user });
    } catch (error) {
        console.error("Помилка відписки від курсу:", error);
        res.status(500).json({ message: "Помилка сервера при відписці" });
    }
});

// ==========================================
// ====== Видалення студента з курсу ======
// ==========================================
router.post('/:courseId/remove-student', auth, async (req, res) => {
    try {
        const { courseId } = req.params;
        const { studentId } = req.body;

        if (!isValidId(courseId) || !isValidId(studentId)) {
            return res.status(400).json({ message: 'Некоректні ID курсу або студента.' });
        }

        // 1. Знаходимо курс і перевіряємо права (чи це курс цього викладача)
        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({ message: 'Курс не знайдено.' });
        }
        if (course.author.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'У вас немає прав для видалення студентів з цього курсу.' });
        }

        // 2. Видаляємо студента з масиву allowedStudents курсу
        await Course.findByIdAndUpdate(
            courseId,
            { $pull: { allowedStudents: studentId } },
            { new: true }
        );

        // 3. Знаходимо студента і видаляємо курс з масиву enrolledCourses
        const student = await User.findById(studentId);
        if (student) {
             await User.findByIdAndUpdate(
                studentId,
                { $pull: { enrolledCourses: courseId } },
                { new: true }
            );
        }

        // 4. (Опціонально) Оновлюємо статус в інвайтах
        // Щоб вчитель міг знову запросити цього студента в майбутньому, 
        // змінимо статус прийнятих інвайтів на 'withdrawn' (відкликано) або просто видалимо їх.
        const Invitation = require('../models/Invitation'); // Переконайся, що шлях правильний
        await Invitation.deleteMany({
            course: courseId,
            studentEmail: student?.email.toLowerCase(), // Якщо студента знайшли
            status: 'accepted'
        });

        res.json({ message: 'Студента успішно відраховано з курсу.' });

    } catch (err) {
        console.error('Помилка при видаленні студента з курсу:', err);
        res.status(500).json({ message: 'Помилка сервера при відрахуванні студента.', error: err.message });
    }
});

// routes/courses.js

router.post('/:id/notify-students', auth, async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: "Курс не знайдено" });

        // Перевіряємо, чи це автор курсу
        if (course.author.toString() !== req.user.id) {
            return res.status(403).json({ message: "Немає доступу" });
        }

        const User = require('../models/User');
        const sendNotification = require('../utils/notifier');

        // 1. Знаходимо всіх студентів цього курсу
        const enrolledStudents = await User.find({ 
            enrolledCourses: course._id,
            role: 'student' 
        });

        if (enrolledStudents.length === 0) {
            return res.json({ message: "На курс ще ніхто не підписаний" });
        }

        // 2. Розсилаємо ОДНЕ спільне сповіщення всім
        // В дзвіночок і на пошту (як загальний мейл)
        await Promise.all(enrolledStudents.map(student => 
            sendNotification({
                userId: student._id,
                title: `📚 Оновлення у курсі: "${course.title}"`,
                message: `Викладач додав нові навчальні матеріали. Завітайте у кабінет, щоб продовжити навчання!`,
                type: 'success',
                link: `/frontend/student/course-view.html?id=${course._id}`,
                sendEmail: true // 🔥 Тут шлемо один гарний лист
            })
        ));

        res.json({ message: `Сповіщення надіслано ${enrolledStudents.length} студентам` });
    } catch (err) {
        res.status(500).json({ message: "Помилка сервера" });
    }
});

router.delete('/:id', auth, async (req, res) => {
    try {
        const courseId = req.params.id;

        // 1. Знаходимо курс, щоб перевірити права (видалити може тільки автор або адмін)
        const course = await Course.findById(courseId);
        if (!course) return res.status(404).json({ error: "Курс не знайдено" });

        if (course.author.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: "У вас немає прав на видалення цього курсу" });
        }

        // 2. ОЧИЩЕННЯ У СТУДЕНТІВ: Видаляємо ID курсу з масивів enrolledCourses усіх юзерів
        await User.updateMany(
            { enrolledCourses: courseId },
            { $pull: { enrolledCourses: courseId } }
        );

        // 3. ВИДАЛЕННЯ РЕЗУЛЬТАТІВ: Видаляємо всі спроби проходження (Result)
        await Result.deleteMany({ course: courseId });

        // 4. ВИДАЛЕННЯ ЧЕРНЕТОК: Очищуємо всі незавершені тести (Draft)
        await Draft.deleteMany({ courseId: courseId });

        // 5. ВИДАЛЕННЯ ЗАПРОШЕНЬ: Очищуємо всі інвайти
        await Invitation.deleteMany({ courseId: courseId });

        // 6. ВИДАЛЕННЯ САМОГО КУРСУ
        await Course.findByIdAndDelete(courseId);

        res.json({ message: "Курс та всі пов'язані дані (результати, студенти, інвайти) успішно видалені назавжди." });
    } catch (error) {
        console.error('Помилка видалення курсу:', error);
        res.status(500).json({ error: "Помилка сервера при видаленні" });
    }
});

module.exports = router;