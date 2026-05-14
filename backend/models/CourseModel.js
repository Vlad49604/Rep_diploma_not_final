const mongoose = require('mongoose');

const OptionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  isCorrect: { type: Boolean, default: false }
});

const PairSchema = new mongoose.Schema({
  left: { type: String, required: true },
  right: { type: String, required: true }
});

const TaskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  taskType: { type: String, required: true }, // multiple, essay, gap, matching
  options: [OptionSchema], // Використовуємо під-схему для валідації
  explanation: { type: String },
  gapText: { type: String },
  gapAnswer: { type: String },
  pairs: [PairSchema], // Використовуємо під-схему
  image: { type: String },
  audio: { type: String }
});

const SectionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  tasks: [TaskSchema],
  image: { type: String }
});

const CourseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  image: { type: String },
  sections: [SectionSchema],

  // --- ЛОГІКА ДОСТУПУ ТА АВТОРСТВА ---

  // Поле НЕОБОВ'ЯЗКОВЕ (щоб не зламати старі адмін-курси)
  author: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: false 
  },

  // Допомагає швидко відрізнити офіційний контент від авторського
  authorRole: { 
    type: String, 
    enum: ['admin', 'teacher'], 
    default: 'admin' 
  },

  // Маркер системного курсу (за замовчуванням true для адміна)
  isSystem: {
    type: Boolean,
    default: true
  },

  // Масив ID студентів, які мають доступ до цього курсу
  allowedStudents: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],

  price: { type: Number, default: 0 }, // 0 - безкоштовний, > 0 - платний

  // Чи бачать курс усі користувачі (для адмінів зазвичай true)
  isPublic: { 
    type: Boolean, 
    default: true 
  }
}, { 
  timestamps: true // Автоматично додає createdAt та updatedAt
});

module.exports = mongoose.model('Course', CourseSchema);