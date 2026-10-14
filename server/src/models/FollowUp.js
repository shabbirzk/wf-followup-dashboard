const mongoose = require('mongoose');

const FollowUpSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true
    },
    salesperson: {
      type: String,
      trim: true
    },
    dueAt: {
      type: Date,
      required: true
    },
    type: {
      type: String,
      enum: ['Call', 'WhatsApp', 'Email', 'Visit', 'Meeting', 'Warehouse'],
      default: 'Call'
    },
    status: {
      type: String,
      enum: ['Pending', 'Completed'],
      default: 'Pending'
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Urgent'],
      default: 'Medium'
    },
    summary: {
      type: String,
      trim: true
    },
    nextAction: {
      type: String,
      trim: true
    },
    completedAt: {
      type: Date
    }
  },
  { timestamps: true }
);

FollowUpSchema.index({ status: 1, dueAt: 1 });
FollowUpSchema.index({ customer: 1, dueAt: 1 });

module.exports = mongoose.models.FollowUp || mongoose.model('FollowUp', FollowUpSchema);
