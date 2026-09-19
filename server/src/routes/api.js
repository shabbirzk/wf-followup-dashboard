const router = require('express').Router();

const mongoose = require('mongoose');
const webpush = require('web-push');

const Customer = require('../models/Customer');
const FollowUp = require('../models/FollowUp');
const Salesperson = require('../models/Salesperson');

/* ========================================================
   WEB PUSH CONFIGURATION
   ======================================================== */

const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY || '';

const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY || '';

const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT ||
  'mailto:admin@westernfurniture.ae';

/*
 * Public API URL used by the service worker for
 * notification actions such as Snooze and Complete.
 */
const PUBLIC_API_URL =
  process.env.PUBLIC_API_URL ||
  'https://wf-followup-api1.onrender.com/api';

if (
  VAPID_PUBLIC_KEY &&
  VAPID_PRIVATE_KEY
) {
  webpush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

/* ========================================================
   NOTIFICATION SUBSCRIPTION MODEL
   ======================================================== */

const NotificationSubscriptionSchema =
  new mongoose.Schema(
    {
      salesperson: {
        type: String,
        trim: true,
        required: true
      },

      salespersonKey: {
        type: String,
        trim: true,
        required: true,
        index: true
      },

      endpoint: {
        type: String,
        required: true
      },

      subscription: {
        type: Object,
        required: true
      }
    },
    {
      timestamps: true
    }
  );

/*
 * One browser/device push endpoint may be enabled for
 * multiple salespersons.
 *
 * Therefore:
 *
 * endpoint + salespersonKey
 *
 * is the unique association.
 */
NotificationSubscriptionSchema.index(
  {
    endpoint: 1,
    salespersonKey: 1
  },
  {
    unique: true
  }
);

const NotificationSubscription =
  mongoose.models.NotificationSubscription ||
  mongoose.model(
    'NotificationSubscription',
    NotificationSubscriptionSchema
  );

/*
 * Remove the old endpoint-only unique index left by
 * the previous notification system.
 *
 * Old:
 * endpoint: unique
 *
 * New:
 * endpoint + salespersonKey: unique
 */
const removeLegacyNotificationEndpointIndex =
  async () => {
    try {
      const indexes =
        await NotificationSubscription
          .collection
          .indexes();

      const legacyIndex =
        indexes.find(
          (index) =>
            index.name === 'endpoint_1' &&
            index.unique === true
        );

      if (legacyIndex) {
        await NotificationSubscription
          .collection
          .dropIndex(
            'endpoint_1'
          );

        console.log(
          '[Notifications] Removed legacy unique endpoint index.'
        );
      }
    } catch (error) {
      console.error(
        '[Notifications] Unable to remove legacy endpoint index:',
        error
      );
    }
  };

removeLegacyNotificationEndpointIndex();

/* ========================================================
   NOTIFICATION DELIVERY MODEL
   ======================================================== */

const NotificationDeliverySchema =
  new mongoose.Schema(
    {
      followUp: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FollowUp',
        required: true
      },

      salespersonKey: {
        type: String,
        required: true
      },

      sentAt: {
        type: Date,
        default: Date.now
      }
    },
    {
      timestamps: true
    }
  );

NotificationDeliverySchema.index(
  {
    followUp: 1,
    salespersonKey: 1
  },
  {
    unique: true
  }
);

const NotificationDelivery =
  mongoose.models.NotificationDelivery ||
  mongoose.model(
    'NotificationDelivery',
    NotificationDeliverySchema
  );

/* ========================================================
   HELPER
   ======================================================== */

const cleanName = (value) => {
  if (!value) return '';

  return String(value).trim();
};

const salespersonKey = (value) =>
  cleanName(value).toLowerCase();

/*
 * Find salesperson from master using a case-insensitive
 * name comparison.
 */
const findSalesperson = async (name) => {
  const cleaned =
    cleanName(name);

  if (!cleaned) {
    return null;
  }

  const salespersons =
    await Salesperson.find({
      status: 'Active'
    });

  return (
    salespersons.find(
      (sp) =>
        cleanName(sp.name)
          .toLowerCase() ===
        cleaned.toLowerCase()
    ) || null
  );
};

/* ========================================================
   BROWSER NOTIFICATION / PUSH SUBSCRIPTION
   ======================================================== */

/*
 * Get VAPID public key.
 */
router.get(
  '/notifications/vapid-public-key',
  async (req, res) => {
    try {
      if (
        !VAPID_PUBLIC_KEY ||
        !VAPID_PRIVATE_KEY
      ) {
        return res.status(500).json({
          message:
            'Web push VAPID keys are not configured on the server.'
        });
      }

      res.json({
        publicKey:
          VAPID_PUBLIC_KEY
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          error.message
      });
    }
  }
);

/*
 * ======================================================
 * GET NOTIFICATION SUBSCRIPTIONS FOR THIS BROWSER
 * ======================================================
 *
 * The browser sends its Push endpoint.
 *
 * MongoDB returns every salesperson associated
 * with that endpoint.
 *
 * Example:
 *
 * endpoint A
 *    -> Ahmed
 *    -> Mushtaq
 *    -> John
 *
 * This is what allows multiple salespersons to
 * use the same browser.
 */
router.get(
  '/notifications/subscriptions',
  async (req, res) => {
    try {
      const endpoint =
        cleanName(
          req.query?.endpoint
        );

      if (!endpoint) {
        return res.status(400).json({
          message:
            'Push subscription endpoint is required.'
        });
      }

      const subscriptions =
        await NotificationSubscription.find({
          endpoint
        }).select({
          salesperson: 1,
          salespersonKey: 1,
          endpoint: 1
        });

      const salespersons = [];

      subscriptions.forEach(
        (record) => {
          const name =
            cleanName(
              record.salesperson
            );

          if (
            name &&
            !salespersons.some(
              (existing) =>
                salespersonKey(
                  existing
                ) ===
                salespersonKey(name)
            )
          ) {
            salespersons.push(name);
          }
        }
      );

      res.json({
        success: true,
        salespersons
      });
    } catch (error) {
      console.error(
        'Notification subscription status error:',
        error
      );

      res.status(500).json({
        message:
          error.message
      });
    }
  }
);

/*
 * ======================================================
 * ENABLE NOTIFICATIONS FOR ONE SALESPERSON
 * ======================================================
 *
 * IMPORTANT:
 *
 * We DO NOT update by endpoint alone.
 *
 * We update by:
 *
 * endpoint + salespersonKey
 *
 * Therefore the same browser can have:
 *
 * endpoint A + Ahmed
 * endpoint A + Mushtaq
 * endpoint A + John
 */
router.post(
  '/notifications/subscribe',
  async (req, res) => {
    try {
      const {
        salesperson,
        subscription
      } = req.body;

      const cleanedSalesperson =
        cleanName(
          salesperson
        );

      if (!cleanedSalesperson) {
        return res.status(400).json({
          message:
            'Salesperson is required.'
        });
      }

      if (
        !subscription ||
        !subscription.endpoint
      ) {
        return res.status(400).json({
          message:
            'Valid push subscription is required.'
        });
      }

      /*
       * Resolve salesperson against master.
       */
      const masterSalesperson =
        await findSalesperson(
          cleanedSalesperson
        );

      const officialSalesperson =
        masterSalesperson
          ? masterSalesperson.name
          : cleanedSalesperson;

      const key =
        salespersonKey(
          officialSalesperson
        );

      /*
       * IMPORTANT:
       *
       * Same endpoint can belong to
       * multiple salespersons.
       */
      const saved =
        await NotificationSubscription
          .findOneAndUpdate(
            {
              endpoint:
                subscription.endpoint,

              salespersonKey:
                key
            },
            {
              salesperson:
                officialSalesperson,

              salespersonKey:
                key,

              endpoint:
                subscription.endpoint,

              subscription
            },
            {
              new: true,
              upsert: true,
              setDefaultsOnInsert: true
            }
          );

      res.json({
        success: true,

        salesperson:
          officialSalesperson,

        subscriptionId:
          saved._id
      });
    } catch (error) {
      console.error(
        'Notification subscription error:',
        error
      );

      res.status(400).json({
        message:
          error.message
      });
    }
  }
);

/*
 * ======================================================
 * DISABLE NOTIFICATIONS FOR ONE SALESPERSON
 * ======================================================
 *
 * IMPORTANT:
 *
 * This does NOT unsubscribe the browser Push
 * subscription.
 *
 * It removes only:
 *
 * endpoint + salespersonKey
 *
 * So if the browser has:
 *
 * Ahmed
 * Mushtaq
 * John
 *
 * and Ahmed is disabled,
 *
 * Mushtaq and John remain active.
 */
router.delete(
  '/notifications/subscribe',
  async (req, res) => {
    try {
      const endpoint =
        cleanName(
          req.body?.endpoint
        );

      const cleanedSalesperson =
        cleanName(
          req.body?.salesperson
        );

      if (!endpoint) {
        return res.status(400).json({
          message:
            'Push subscription endpoint is required.'
        });
      }

      if (!cleanedSalesperson) {
        return res.status(400).json({
          message:
            'Salesperson is required to disable reminders.'
        });
      }

      const key =
        salespersonKey(
          cleanedSalesperson
        );

      /*
       * Delete ONLY this salesperson
       * from this browser.
       */
      await NotificationSubscription.deleteOne(
        {
          endpoint,
          salespersonKey: key
        }
      );

      /*
       * Check how many salesperson associations
       * remain for this browser.
       */
      const remaining =
        await NotificationSubscription
          .countDocuments({
            endpoint
          });

      res.json({
        success: true,
        remaining
      });
    } catch (error) {
      console.error(
        'Notification unsubscribe error:',
        error
      );

      res.status(500).json({
        message:
          error.message
      });
    }
  }
);

/* ========================================================
   CHECK AND SEND FOLLOW-UP REMINDERS
   ======================================================== */

const checkDueFollowUpReminders =
  async () => {
    if (
      !VAPID_PUBLIC_KEY ||
      !VAPID_PRIVATE_KEY
    ) {
      console.log(
        'Web push reminders skipped: VAPID keys are not configured.'
      );

      return;
    }

    try {
      const now =
        new Date();

      console.log(
        `[Reminder Check] Starting reminder check at ${now.toISOString()}`
      );

      /*
       * Find all pending follow-ups that are due.
       *
       * This includes overdue follow-ups as well.
       */
      const followups =
        await FollowUp.find({
          status: 'Pending',

          dueAt: {
            $lte: now
          }
        }).populate(
          'customer'
        );

      console.log(
        `[Reminder Check] Pending overdue follow-ups found: ${followups.length}`
      );

      if (!followups.length) {
        return;
      }

      for (
        const followup of followups
      ) {
        try {
          /*
           * Ignore follow-ups without a salesperson.
           */
          if (
            !cleanName(
              followup.salesperson
            )
          ) {
            console.log(
              `[Reminder Check] Skipped follow-up ${followup._id}: salesperson is missing.`
            );

            continue;
          }

          /*
           * Ignore deleted/missing customers.
           */
          if (
            !followup.customer
          ) {
            console.log(
              `[Reminder Check] Skipped follow-up ${followup._id}: customer is missing.`
            );

            continue;
          }

          /*
           * Do not remind for customers that are
           * already converted or completed.
           */
          const customerStatus =
            String(
              followup.customer.status ||
                ''
            )
              .trim()
              .toLowerCase();

          if (
            customerStatus ===
              'converted' ||
            customerStatus ===
              'completed'
          ) {
            console.log(
              `[Reminder Check] Skipped follow-up ${followup._id}: customer status is ${customerStatus}.`
            );

            continue;
          }

          const spKey =
            salespersonKey(
              followup.salesperson
            );

          /*
           * Find ALL browsers/devices registered
           * for this salesperson.
           */
          const subscriptions =
            await NotificationSubscription
              .find({
                salespersonKey:
                  spKey
              });

          console.log(
            `[Reminder Check] Follow-up ${followup._id} | Salesperson: "${followup.salesperson}" | Key: "${spKey}" | Browser subscriptions: ${subscriptions.length}`
          );

          if (
            !subscriptions.length
          ) {
            console.log(
              `[Reminder Check] No browser subscription found for salesperson "${followup.salesperson}".`
            );

            continue;
          }

          /*
           * Prevent duplicate notification for the
           * same follow-up and salesperson.
           */
          try {
            await NotificationDelivery.create(
              {
                followUp:
                  followup._id,

                salespersonKey:
                  spKey,

                sentAt:
                  new Date()
              }
            );
          } catch (
            deliveryError
          ) {
            /*
             * Duplicate key means this reminder was
             * already processed.
             */
            if (
              deliveryError?.code ===
              11000
            ) {
              console.log(
                `[Reminder Check] Follow-up ${followup._id} already has a delivery record for salesperson "${followup.salesperson}".`
              );

              continue;
            }

            throw deliveryError;
          }

          const customerName =
            cleanName(
              followup.customer.name
            ) ||
            cleanName(
              followup.customer.customerName
            ) ||
            'Customer';

          const followupType =
            cleanName(
              followup.type
            ) ||
            'Follow-up';

          const priority =
            cleanName(
              followup.priority
            );

          const dueTime =
            new Date(
              followup.dueAt
            ).toLocaleString(
              'en-GB',
              {
                timeZone:
                  'Asia/Dubai',

                day: '2-digit',

                month: '2-digit',

                year: 'numeric',

                hour: '2-digit',

                minute: '2-digit',

                hour12: true
              }
            );

          const payload =
            JSON.stringify({
              title:
                'Follow-up Reminder',

              body:
                `${customerName} - ${followupType} follow-up is due${priority ? ` (${priority})` : ''}. Due: ${dueTime}`,

              salesperson:
                followup.salesperson,

              followupId:
                String(
                  followup._id
                ),

              customerId:
                String(
                  followup.customer._id
                ),

              url:
                `/?tab=followups&followupId=${encodeURIComponent(
                  String(
                    followup._id
                  )
                )}`,

              /*
               * Allows the service worker to call the
               * backend directly for notification actions.
               */
              apiUrl:
                PUBLIC_API_URL
            });

          console.log(
            `[Reminder Check] Attempting push notification for follow-up ${followup._id} to ${subscriptions.length} subscription(s).`
          );

          let successfulSends =
            0;

          /*
           * Send to every browser/device registered
           * for this salesperson.
           */
          for (
            const record of subscriptions
          ) {
            try {
              await webpush.sendNotification(
                record.subscription,
                payload
              );

              successfulSends++;

              console.log(
                `[Reminder Check] Push notification sent successfully for follow-up ${followup._id} to subscription ${record._id}.`
              );
            } catch (
              pushError
            ) {
              console.error(
                'Push notification error:',
                pushError
              );

              /*
               * 404 / 410 means the browser subscription
               * is no longer valid.
               */
              if (
                pushError?.statusCode ===
                  404 ||
                pushError?.statusCode ===
                  410
              ) {
                await NotificationSubscription
                  .deleteOne({
                    _id:
                      record._id
                  });
              }
            }
          }

          console.log(
            `[Reminder Check] Follow-up ${followup._id} completed with ${successfulSends} successful push send(s).`
          );

          /*
           * If every subscription failed, remove the
           * delivery record so the system can retry.
           */
          if (
            successfulSends ===
            0
          ) {
            await NotificationDelivery
              .deleteOne({
                followUp:
                  followup._id,

                salespersonKey:
                  spKey
              });
          }
        } catch (
          followupError
        ) {
          console.error(
            `Reminder processing error for follow-up ${followup._id}:`,
            followupError
          );
        }
      }
    } catch (error) {
      console.error(
        'Follow-up reminder check error:',
        error
      );
    }
  };

/* ========================================================
   MANUAL REMINDER CHECK
   ======================================================== */

router.post(
  '/notifications/check',
  async (req, res) => {
    try {
      await checkDueFollowUpReminders();

      res.json({
        success: true,

        message:
          'Follow-up reminder check completed.'
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          error.message
      });
    }
  }
);

/* ========================================================
   NOTIFICATION ACTIONS
   ======================================================== */

router.post(
  '/notifications/action',
  async (req, res) => {
    try {
      const {
        action,
        followupId
      } = req.body;

      if (!followupId) {
        return res.status(400).json({
          message:
            'Follow-up ID is required.'
        });
      }

      if (
        ![
          'snooze',
          'complete',
          'dismiss'
        ].includes(action)
      ) {
        return res.status(400).json({
          message:
            'Invalid notification action.'
        });
      }

      /*
       * DISMISS
       *
       * Close the browser notification only.
       *
       * The delivery record is intentionally kept so
       * the same due reminder is not immediately sent
       * again by the scheduler.
       */
      if (
        action ===
        'dismiss'
      ) {
        return res.json({
          success: true,
          action: 'dismiss'
        });
      }

      /*
       * Find follow-up for Snooze / Complete.
       */
      const followup =
        await FollowUp.findById(
          followupId
        );

      if (!followup) {
        return res.status(404).json({
          message:
            'Follow-up not found.'
        });
      }

      /*
       * SNOOZE
       *
       * Move the follow-up 10 minutes into
       * the future and remove the previous
       * delivery records.
       */
      if (
        action ===
        'snooze'
      ) {
        if (
          followup.status !==
          'Pending'
        ) {
          return res.json({
            success: true,

            action: 'snooze',

            message:
              'Follow-up is no longer pending.'
          });
        }

        const snoozedUntil =
          new Date(
            Date.now() +
              10 *
                60 *
                1000
          );

        followup.dueAt =
          snoozedUntil;

        await followup.save();

        await NotificationDelivery
          .deleteMany({
            followUp:
              followup._id
          });

        return res.json({
          success: true,

          action: 'snooze',

          dueAt:
            snoozedUntil
        });
      }

      /*
       * COMPLETE
       *
       * Mark the follow-up as completed and
       * remove its notification delivery record.
       */
      if (
        action ===
        'complete'
      ) {
        followup.status =
          'Completed';

        followup.completedAt =
          new Date();

        await followup.save();

        await NotificationDelivery
          .deleteMany({
            followUp:
              followup._id
          });

        return res.json({
          success: true,

          action: 'complete'
        });
      }
    } catch (error) {
      console.error(
        'Notification action error:',
        error
      );

      res.status(500).json({
        message:
          error.message
      });
    }
  }
);

/* ========================================================
   SALESPERSON MASTER
   ======================================================== */

router.get(
  '/salespersons',
  async (req, res) => {
    try {
      const salespersons =
        await Salesperson.find()
          .sort({
            name: 1
          });

      res.json(
        salespersons
      );
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          error.message
      });
    }
  }
);

router.post(
  '/salespersons',
  async (req, res) => {
    try {
      const name =
        cleanName(
          req.body.name
        );

      if (!name) {
        return res.status(400).json({
          message:
            'Salesperson name is required.'
        });
      }

      /*
       * Prevent duplicate salesperson names.
       */
      const existing =
        await Salesperson.findOne({
          name: {
            $regex:
              `^${name.replace(
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
       */
      const last =
        await Salesperson.findOne()
          .sort({
            salespersonCode:
              -1
          });

      let nextNumber =
        1;

      if (
        last?.salespersonCode
      ) {
        const match =
          last.salespersonCode.match(
            /SP-(\d+)/
          );

        if (match) {
          nextNumber =
            Number(
              match[1]
            ) + 1;
        }
      }

      const salespersonCode =
        `SP-${String(
          nextNumber
        ).padStart(
          4,
          '0'
        )}`;

      const salesperson =
        await Salesperson.create({
          ...req.body,

          name,

          salespersonCode
        });

      res.status(201).json(
        salesperson
      );
    } catch (error) {
      console.error(error);

      res.status(400).json({
        message:
          error.message
      });
    }
  }
);

router.patch(
  '/salespersons/:id',
  async (req, res) => {
    try {
      const data = {
        ...req.body
      };

      if (data.name) {
        data.name =
          cleanName(
            data.name
          );
      }

      const salesperson =
        await Salesperson
          .findByIdAndUpdate(
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

      res.json(
        salesperson
      );
    } catch (error) {
      console.error(error);

      res.status(400).json({
        message:
          error.message
      });
    }
  }
);

/* ========================================================
   CUSTOMER MASTER
   ======================================================== */

router.get(
  '/customers',
  async (req, res) => {
    try {
      const customers =
        await Customer.find()
          .sort({
            createdAt: -1
          });

      res.json(
        customers
      );
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          error.message
      });
    }
  }
);

router.post(
  '/customers',
  async (req, res) => {
    try {
      const data = {
        ...req.body
      };

      if (
        data.assignedSalesperson
      ) {
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

      const count =
        await Customer.countDocuments();

      const customerCode =
        `CUST-${String(
          count + 1
        ).padStart(
          4,
          '0'
        )}`;

      const customer =
        await Customer.create({
          ...data,

          customerCode,

          quotationAmount:
            Number(
              data.quotationAmount ||
                0
            )
        });

      res.status(201).json(
        customer
      );
    } catch (error) {
      console.error(error);

      res.status(400).json({
        message:
          error.message
      });
    }
  }
);

router.patch(
  '/customers/:id',
  async (req, res) => {
    try {
      const data = {
        ...req.body
      };

      if (
        data.assignedSalesperson
      ) {
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

      /*
       * Quotation amount revision tracking.
       */
      if (
        Object.prototype.hasOwnProperty.call(
          data,
          'quotationAmount'
        )
      ) {
        const existingCustomer =
          await Customer.findById(
            req.params.id
          );

        if (!existingCustomer) {
          return res.status(404).json({
            message:
              'Customer not found.'
          });
        }

        const newQuotationAmount =
          Number(
            data.quotationAmount ||
              0
          );

        if (
          existingCustomer.originalQuotationAmount ===
            undefined ||
          existingCustomer.originalQuotationAmount ===
            null
        ) {
          data.originalQuotationAmount =
            existingCustomer.quotationAmount ||
            0;
        }

        if (
          newQuotationAmount !==
          Number(
            existingCustomer.quotationAmount ||
              0
          )
        ) {
          data.quotationAmountUpdatedAt =
            new Date();
        }

        data.quotationAmount =
          newQuotationAmount;
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

      res.json(
        customer
      );
    } catch (error) {
      console.error(error);

      res.status(400).json({
        message:
          error.message
      });
    }
  }
);

/* ========================================================
   FOLLOW-UPS
   ======================================================== */

router.get(
  '/followups',
  async (req, res) => {
    try {
      const followups =
        await FollowUp.find()
          .populate(
            'customer'
          )
          .sort({
            dueAt: 1
          });

      res.json(
        followups
      );
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          error.message
      });
    }
  }
);

router.post(
  '/followups',
  async (req, res) => {
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
          customer.assignedSalesperson ||
          '';
      }

      /*
       * Resolve salesperson against master.
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
       * Duplicate protection.
       */
      const dueDate =
        new Date(
          data.dueAt
        );

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
          Date.now() -
            30000
        );

      const duplicate =
        await FollowUp.findOne({
          customer:
            data.customer,

          salesperson:
            data.salesperson,

          dueAt:
            dueDate,

          type:
            data.type ||
            'Call',

          status:
            'Pending',

          createdAt: {
            $gte:
              duplicateSince
          }
        });

      if (duplicate) {
        return res.status(409).json({
          message:
            'This follow-up was already created. Duplicate submission was blocked.',

          followup:
            duplicate
        });
      }

      data.dueAt =
        dueDate;

      const followup =
        await FollowUp.create(
          data
        );

      const populatedFollowup =
        await FollowUp.findById(
          followup._id
        ).populate(
          'customer'
        );

      res.status(201).json(
        populatedFollowup
      );
    } catch (error) {
      console.error(error);

      res.status(400).json({
        message:
          error.message
      });
    }
  }
);

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
        ).populate(
          'customer'
        );

      if (!followup) {
        return res.status(404).json({
          message:
            'Follow-up not found.'
        });
      }

      res.json(
        followup
      );
    } catch (error) {
      console.error(error);

      res.status(400).json({
        message:
          error.message
      });
    }
  }
);

/* ========================================================
   DASHBOARD SUMMARY
   ======================================================== */

router.get(
  '/summary',
  async (req, res) => {
    try {
      const now =
        new Date();

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
      ] =
        await Promise.all([
          Customer.countDocuments(),

          FollowUp.countDocuments({
            status:
              'Pending'
          }),

          FollowUp.countDocuments({
            status:
              'Pending',

            dueAt: {
              $gte:
                now,

              $lte:
                end
            }
          }),

          FollowUp.countDocuments({
            status:
              'Pending',

            dueAt: {
              $lt:
                now
            }
          }),

          FollowUp.countDocuments({
            status:
              'Completed'
          }),

          Customer.countDocuments({
            status:
              'Converted'
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
        quotationResult[0]?.total ||
        0;

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
        message:
          error.message
      });
    }
  }
);

/* ========================================================
   EXPORT
   ======================================================== */

module.exports =
  router;

/*
 * Export reminder checker so server/index.js can
 * start the automatic reminder scheduler.
 */
module.exports
  .checkDueFollowUpReminders =
  checkDueFollowUpReminders;
