const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema(
  {
    customerCode: {
      type: String,
      unique: true,
      required: true,
      trim: true
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

    location: {
      type: String,
      trim: true
    },

    source: {
      type: String,
      default: 'Walk-in',
      trim: true
    },

    /*
     * Existing database uses salesperson NAME.
     * We keep this field as String to avoid breaking
     * existing records.
     */
    assignedSalesperson: {
      type: String,
      trim: true
    },

    status: {
      type: String,
      enum: [
        'New',
        'Contacted',
        'Quoted',
        'Negotiation',
        'Converted',
        'Lost',
        'Active'
      ],
      default: 'New'
    },

    productInterest: {
      type: String,
      trim: true
    },

    quotationAmount: {
      type: Number,
      default: 0,
      min: 0
    },

    originalQuotationAmount: {
      type: Number,
      default: 0,
      min: 0
    },

    quotationRevisionRemark: {
      type: String,
      trim: true
    },

    quotationAmountUpdatedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

module.exports =
  mongoose.models.Customer ||
  mongoose.model('Customer', CustomerSchema);
