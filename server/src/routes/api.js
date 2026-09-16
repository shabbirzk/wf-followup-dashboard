const router = require('express').Router();

const Customer = require('../models/Customer');
const FollowUp = require('../models/FollowUp');
const Salesperson = require('../models/Salesperson');

/* =========================
   SALESPERSON MASTER
========================= */

// Get all salespersons
router.get('/salespersons', async (req, res) => {
  try {
    const salespersons = await Salesperson.find()
      .sort({ name: 1 });

    res.json(salespersons);
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

// Add salesperson
router.post('/salespersons', async (req, res) => {
  try {
    const count = await Salesperson.countDocuments();

    const salespersonCode = `SP-${String(
      count + 1
    ).padStart(4, '0')}`;

    const salesperson = await Salesperson.create({
      ...req.body,
      salespersonCode
    });

    res.status(201).json(salesperson);
  } catch (error) {
    res.status(400).json({
      message: error.message
    });
  }
});

// Update salesperson
router.patch('/salespersons/:id', async (req, res) => {
  try {
    const salesperson =
      await Salesperson.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
          new: true,
          runValidators: true
        }
      );

    if (!salesperson) {
      return res.status(404).json({
        message: 'Salesperson not found'
      });
    }

    res.json(salesperson);
  } catch (error) {
    res.status(400).json({
      message: error.message
    });
  }
});

/* =========================
   CUSTOMER MASTER
========================= */

// Get all customers
router.get('/customers', async (req, res) => {
  try {
    const customers = await Customer.find()
      .sort({ createdAt: -1 });

    res.json(customers);
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

// Add customer
router.post('/customers', async (req, res) => {
  try {
    const count = await Customer.countDocuments();

    const customerCode = `CUST-${String(
      count + 1
    ).padStart(4, '0')}`;

    const customer = await Customer.create({
      ...req.body,
      customerCode
    });

    res.status(201).json(customer);
  } catch (error) {
    res.status(400).json({
      message: error.message
    });
  }
});

// Update customer
router.patch('/customers/:id', async (req, res) => {
  try {
    const customer =
      await Customer.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
          new: true,
          runValidators: true
        }
      );

    if (!customer) {
      return res.status(404).json({
        message: 'Customer not found'
      });
    }

    res.json(customer);
  } catch (error) {
    res.status(400).json({
      message: error.message
    });
  }
});

/* =========================
   FOLLOW-UPS
========================= */

// Get all follow-ups
router.get('/followups', async (req, res) => {
  try {
    const followups = await FollowUp.find()
      .populate('customer')
      .sort({ dueAt: 1 });

    res.json(followups);
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

// Add follow-up
router.post('/followups', async (req, res) => {
  try {
    let data = {
      ...req.body
    };

    /*
      If salesperson is blank, automatically use
      the assigned salesperson from the customer.
    */
    if (!data.salesperson && data.customer) {
      const customer = await Customer.findById(data.customer);

      if (customer) {
        data.salesperson = customer.assignedSalesperson;
      }
    }

    const followup = await FollowUp.create(data);

    const populatedFollowup =
      await FollowUp.findById(followup._id)
        .populate('customer');

    res.status(201).json(populatedFollowup);
  } catch (error) {
    res.status(400).json({
      message: error.message
    });
  }
});

// Update follow-up
router.patch('/followups/:id', async (req, res) => {
  try {
    const data = {
      ...req.body
    };

    if (data.status === 'Completed') {
      data.completedAt = new Date();
    }

    const followup =
      await FollowUp.findByIdAndUpdate(
        req.params.id,
        data,
        {
          new: true,
          runValidators: true
        }
      ).populate('customer');

    if (!followup) {
      return res.status(404).json({
        message: 'Follow-up not found'
      });
    }

    res.json(followup);
  } catch (error) {
    res.status(400).json({
      message: error.message
    });
  }
});

/* =========================
   DASHBOARD SUMMARY
========================= */

router.get('/summary', async (req, res) => {
  try {
    const now = new Date();

    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    const [
      customers,
      pending,
      today,
      overdue,
      completed,
      converted
    ] = await Promise.all([
      Customer.countDocuments(),

      FollowUp.countDocuments({
        status: 'Pending'
      }),

      FollowUp.countDocuments({
        status: 'Pending',
        dueAt: {
          $gte: now,
          $lte: end
        }
      }),

      FollowUp.countDocuments({
        status: 'Pending',
        dueAt: {
          $lt: now
        }
      }),

      FollowUp.countDocuments({
        status: 'Completed'
      }),

      Customer.countDocuments({
        status: 'Converted'
      })
    ]);

    res.json({
      customers,
      pending,
      today,
      overdue,
      completed,
      converted
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

module.exports = router;