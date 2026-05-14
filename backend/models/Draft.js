const mongoose = require('mongoose');

const DraftSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    sectionIdx: { type: Number, required: true },
    currentStep: { type: Number, default: 0 },
    savedAnswers: { type: Array, default: [] },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Draft', DraftSchema);