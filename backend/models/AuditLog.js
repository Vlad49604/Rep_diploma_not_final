const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true }, // Наприклад: "BAN_USER", "PUBLISH_COURSE"
    targetId: { type: mongoose.Schema.Types.ObjectId }, // ID користувача або курсу, якого це стосується
    description: { type: String, required: true }, // Детальний опис: "Заблоковано студента ivan@gmail.com"
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AuditLog', auditLogSchema);