const mongoose = require('mongoose');

const SalespersonSchema = new mongoose.Schema(
  {
    salespersonCode: {
      type: String,
      unique: true,
      required: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    phone: {
      type: String,
      trim: true
    },

    whatsapp: {
      type: String,
      trim: true
    },

    email: {
      type: String,
      trim: true,
      lowercase: true
    },

    department: {
      type: String,
      default: 'Sales'
    },

    location: {
      type: String
    },

    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model(
  'Salesperson',
  SalespersonSchema
);