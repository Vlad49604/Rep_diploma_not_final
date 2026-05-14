const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Може бути null для системних курсів
  
  totalAmount: { type: Number, required: true },    // Скільки заплатив студент (напр. 450)
  platformFee: { type: Number, required: true },    // Комісія адміну (25% або мін. 50, або 100% за системний)
  teacherEarnings: { type: Number, required: true },  // Скільки отримає вчитель
  
  isSystemCourse: { type: Boolean, default: false }, // Для швидкої фільтрації в звітах
  status: { type: String, default: 'completed' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Transaction', TransactionSchema);