const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  salesperson: { type: String, trim: true, default: '' },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  followUp: { type: mongoose.Schema.Types.ObjectId, ref: 'FollowUp', default: null },
  dueAt: { type: Date, required: true },
  priority: { type: String, enum: ['Low', 'Medium', 'High', 'Urgent'], default: 'Medium' },
  status: { type: String, enum: ['Pending', 'Completed'], default: 'Pending' },
  completedAt: { type: Date, default: null }
}, { timestamps: true });

TaskSchema.index({ status: 1, dueAt: 1 });
TaskSchema.index({ salesperson: 1, status: 1, dueAt: 1 });

module.exports = mongoose.models.Task || mongoose.model('Task', TaskSchema);
