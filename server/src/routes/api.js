const router = require('express').Router();

const Customer = require('../models/Customer');
const FollowUp = require('../models/FollowUp');
const Salesperson = require('../models/Salesperson');

/* ========================================================
   HELPER
   ======================================================== */

const cleanName = (value) => {
  if (!value) return '';
  return String(value).trim();
};

/*
 * Find salesperson from master using a case-insensitive
 * name comparison.
 */
const findSalesperson = async (name) => {
  const cleaned = cleanName(name);

  if (!cleaned) return null;

  const salespersons =
    await Salesperson.find({
      status: 'Active'
    });

  return (
    salespersons.find(
      (sp) =>
        cleanName(sp.name).toLowerCase() ===
        cleaned.toLowerCase()
    ) || null
  );
};

/* ========================================================
   SALESPERSON MASTER
   ======================================================== */

router.get('/salespersons', async (req, res) => {
  try {
    const salespersons =
      await Salesperson.find().sort({
        name: 1
      });

    res.json(salespersons);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: error.message
    });
  }
});


router.post('/salespersons', async (req, res) => {
  try {
    const name = cleanName(req.body.name);

    if (!name) {
      return res.status(400).json({
        message: 'Salesperson name is required.'
      });
    }

    /*
     * Prevent duplicate salesperson names.
     */
    const existing =
      await Salesperson.findOne({
        name: {
          $regex: `^${name.replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&'
          )}$`,
          $options: 'i'
        }
      });

    if (existing) {
      return res.status(400).json({
        message:
          'A salesperson with this name already exists.'
      });
    }

    /*
     * Generate next available salesperson code.
     * This is safer than countDocuments because deleted
     * records could otherwise create duplicate codes.
     */
    const last =
      await Salesperson.findOne()
        .sort({
          salespersonCode: -1
        });

    let nextNumber = 1;

    if (last?.salespersonCode) {
      const match =
        last.salespersonCode.match(
          /SP-(\d+)/
        );

      if (match) {
        nextNumber =
          Number(match[1]) + 1;
      }
    }

    const salespersonCode =
      `SP-${String(nextNumber).padStart(
        4,
        '0'
      )}`;

    const salesperson =
      await Salesperson.create({
        ...req.body,
        name,
        salespersonCode
      });

    res.status(201).json(salesperson);
  } catch (error) {
    console.error(error);

    res.status(400).json({
      message: error.message
    });
  }
});


router.patch(
  '/salespersons/:id',
  async (req, res) => {
    try {
      const data = {
        ...req.body
      };

      if (data.name) {
        data.name = cleanName(data.name);
      }

      const salesperson =
        await Salesperson.findByIdAndUpdate(
          req.params.id,
          data,
          {
            new: true,
            runValidators: true
          }
        );

      if (!salesperson) {
        return res.status(404).json({
          message:
            'Salesperson not found.'
        });
      }

      res.json(salesperson);
    } catch (error) {
      console.error(error);

      res.status(400).json({
        message: error.message
      });
    }
  }
);


/* ========================================================
   CUSTOMER MASTER
   ======================================================== */

router.get('/customers', async (req, res) => {
  try {
    const customers =
      await Customer.find().sort({
        createdAt: -1
      });

    res.json(customers);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: error.message
    });
  }
});


router.post('/customers', async (req, res) => {
  try {
    const data = {
      ...req.body
    };

    if (data.assignedSalesperson) {
      const salesperson =
        await findSalesperson(
          data.assignedSalesperson
        );

      if (salesperson) {
        /*
         * Always store the official master name.
         */
        data.assignedSalesperson =
          salesperson.name;
      } else {
        data.assignedSalesperson =
          cleanName(
            data.assignedSalesperson
          );
      }
    }

    const count =
      await Customer.countDocuments();

    const customerCode =
      `CUST-${String(
        count + 1
      ).padStart(4, '0')}`;

    const customer =
      await Customer.create({
        ...data,
        customerCode,
        quotationAmount:
          Number(
            data.quotationAmount || 0
          )
      });

    res.status(201).json(customer);
  } catch (error) {
    console.error(error);

    res.status(400).json({
      message: error.message
    });
  }
});


router.patch(
  '/customers/:id',
  async (req, res) => {
    try {
      const data = {
        ...req.body
      };

      if (data.assignedSalesperson) {
        const salesperson =
          await findSalesperson(
            data.assignedSalesperson
          );

        if (salesperson) {
          data.assignedSalesperson =
            salesperson.name;
        } else {
          data.assignedSalesperson =
            cleanName(
              data.assignedSalesperson
            );
        }
      }

      const customer =
        await Customer.findByIdAndUpdate(
          req.params.id,
          data,
          {
            new: true,
            runValidators: true
          }
        );

      if (!customer) {
        return res.status(404).json({
          message:
            'Customer not found.'
        });
      }

      res.json(customer);
    } catch (error) {
      console.error(error);

      res.status(400).json({
        message: error.message
      });
    }
  }
);


/* ========================================================
   FOLLOW-UPS
   ======================================================== */

router.get('/followups', async (req, res) => {
  try {
    const followups =
      await FollowUp.find()
        .populate('customer')
        .sort({
          dueAt: 1
        });

    res.json(followups);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: error.message
    });
  }
});


router.post('/followups', async (req, res) => {
  try {
    const data = {
      ...req.body
    };

    if (!data.customer) {
      return res.status(400).json({
        message:
          'Customer is required.'
      });
    }

    if (!data.dueAt) {
      return res.status(400).json({
        message:
          'Follow-up date and time are required.'
      });
    }

    /*
     * Get customer.
     */
    const customer =
      await Customer.findById(
        data.customer
      );

    if (!customer) {
      return res.status(404).json({
        message:
          'Customer not found.'
      });
    }

    /*
     * If salesperson isn't selected,
     * inherit it from customer.
     */
    if (!data.salesperson) {
      data.salesperson =
        customer.assignedSalesperson || '';
    }

    /*
     * Resolve salesperson against master.
     * This fixes values such as:
     *
     * "shikhar "
     * "Shikhar"
     * "SHIKHAR"
     *
     * to the official master name.
     */
    if (data.salesperson) {
      const salesperson =
        await findSalesperson(
          data.salesperson
        );

      if (salesperson) {
        data.salesperson =
          salesperson.name;
      } else {
        data.salesperson =
          cleanName(
            data.salesperson
          );
      }
    }

    /*
     * ====================================================
     * DUPLICATE PROTECTION
     * ====================================================
     *
     * Don't create another pending follow-up for
     * the same customer, salesperson, date/time and type
     * when the previous one was created within 30 seconds.
     *
     * This protects against double-clicks and repeated
     * browser submissions.
     */

    const dueDate =
      new Date(data.dueAt);

    if (
      Number.isNaN(
        dueDate.getTime()
      )
    ) {
      return res.status(400).json({
        message:
          'Invalid follow-up date/time.'
      });
    }

    const duplicateSince =
      new Date(
        Date.now() - 30000
      );

    const duplicate =
      await FollowUp.findOne({
        customer: data.customer,
        salesperson: data.salesperson,
        dueAt: dueDate,
        type: data.type || 'Call',
        status: 'Pending',
        createdAt: {
          $gte: duplicateSince
        }
      });

    if (duplicate) {
      return res.status(409).json({
        message:
          'This follow-up was already created. Duplicate submission was blocked.',
        followup: duplicate
      });
    }

    data.dueAt = dueDate;

    const followup =
      await FollowUp.create(
        data
      );

    const populatedFollowup =
      await FollowUp.findById(
        followup._id
      ).populate('customer');

    res.status(201).json(
      populatedFollowup
    );
  } catch (error) {
    console.error(error);

    res.status(400).json({
      message: error.message
    });
  }
});


router.patch(
  '/followups/:id',
  async (req, res) => {
    try {
      const data = {
        ...req.body
      };

      if (
        data.status ===
        'Completed'
      ) {
        data.completedAt =
          new Date();
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
          message:
            'Follow-up not found.'
        });
      }

      res.json(followup);
    } catch (error) {
      console.error(error);

      res.status(400).json({
        message: error.message
      });
    }
  }
);


/* ========================================================
   DASHBOARD SUMMARY
   ======================================================== */

router.get('/summary', async (req, res) => {
  try {
    const now = new Date();

    const end =
      new Date(now);

    end.setHours(
      23,
      59,
      59,
      999
    );

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

    const quotationResult =
      await Customer.aggregate([
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $ifNull: [
                  '$quotationAmount',
                  0
                ]
              }
            }
          }
        }
      ]);

    const quotationAmount =
      quotationResult[0]?.total || 0;

    res.json({
      customers,
      pending,
      today,
      overdue,
      completed,
      converted,
      quotationAmount
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: error.message
    });
  }
});


module.exports = router;
