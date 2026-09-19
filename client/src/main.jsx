import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import "./style.css";

const API =
  import.meta.env.VITE_API_URL ||
  "https://wf-followup-api1.onrender.com/api";

/* =========================================================
   DUBAI TIMEZONE HELPERS
========================================================= */

const DUBAI_TIMEZONE = "Asia/Dubai";

const fmt = (value) => {
  if (!value) return "";

  return new Date(value).toLocaleString("en-GB", {
    timeZone: DUBAI_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
};

const getDubaiDate = (value = new Date()) => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DUBAI_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
};

const getDubaiToday = () => {
  return getDubaiDate(new Date());
};

const dubaiLocalToISO = (localValue) => {
  if (!localValue) return "";

  const [datePart, timePart] = localValue.split("T");

  if (!datePart || !timePart) return "";

  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  // Dubai = UTC+4
  const utcMillis = Date.UTC(
    year,
    month - 1,
    day,
    hour - 4,
    minute
  );

  return new Date(utcMillis).toISOString();
};

const isoToDubaiLocal = (value) => {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DUBAI_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);

  const getPart = (type) =>
    parts.find((p) => p.type === type)?.value || "";

  return `${getPart("year")}-${getPart(
    "month"
  )}-${getPart("day")}T${getPart(
    "hour"
  )}:${getPart("minute")}`;
};

const isOverdue = (value) => {
  if (!value) return false;

  return new Date(value).getTime() < Date.now();
};

const normalizeName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

/* =========================================================
   SMALL UI COMPONENTS
========================================================= */

const Badge = ({ children, type = "" }) => (
  <span className={`badge ${type}`}>{children}</span>
);

const StatCard = ({ title, value, subtitle }) => (
  <div className="stat-card">
    <div className="stat-title">{title}</div>

    <div className="stat-value">
      {value}
    </div>

    {subtitle && (
      <div className="stat-subtitle">
        {subtitle}
      </div>
    )}
  </div>
);

/* =========================================================
   MAIN APP
========================================================= */

function App() {
  const [activeTab, setActiveTab] =
    useState("dashboard");

  /* =====================================================
     SUMMARY
  ===================================================== */

  const [summary, setSummary] = useState({
    customers: 0,
    pending: 0,
    today: 0,
    overdue: 0,
    completed: 0,
    converted: 0,
    quotationAmount: 0
  });

  const [customers, setCustomers] =
    useState([]);

  const [followUps, setFollowUps] =
    useState([]);

  const [salespersons, setSalespersons] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  /* =====================================================
     DASHBOARD SALESPERSON FILTER
  ===================================================== */

  const [
    dashboardSalespersonFilter,
    setDashboardSalespersonFilter
  ] = useState("All");

  /* =====================================================
     CUSTOMER FORM
  ===================================================== */

  const [customerForm, setCustomerForm] =
    useState({
      name: "",
      phone: "",
      whatsapp: "",
      email: "",
      location: "",
      source: "Walk-in",
      assignedSalesperson: "",
      status: "New",
      productInterest: "",
      quotationAmount: ""
    });

  const [savingCustomer, setSavingCustomer] =
    useState(false);

  /* =====================================================
     CUSTOMER EDIT
  ===================================================== */

  const [editingCustomer, setEditingCustomer] =
    useState(null);

  const [savingCustomerEdit, setSavingCustomerEdit] =
    useState(false);

  /* =====================================================
     SALESPERSON FORM
  ===================================================== */

  const [salespersonForm, setSalespersonForm] =
    useState({
      name: "",
      phone: "",
      location: "",
      status: "Active"
    });

  const [savingSalesperson, setSavingSalesperson] =
    useState(false);

  /* =====================================================
     FOLLOW-UP FORM
  ===================================================== */

  const [followUpForm, setFollowUpForm] =
    useState({
      customer: "",
      salesperson: "",
      dueAt: "",
      type: "Call",
      priority: "Medium",
      summary: "",
      nextAction: ""
    });

  const [savingFollowUp, setSavingFollowUp] =
    useState(false);

  const [completingId, setCompletingId] =
    useState(null);

  /* =====================================================
     FOLLOW-UP CUSTOMER SEARCH
  ===================================================== */

  const [followUpCustomerSearch, setFollowUpCustomerSearch] =
    useState("");

  const [showCustomerResults, setShowCustomerResults] =
    useState(false);

  /* =====================================================
     FOLLOW-UP EDIT
  ===================================================== */

  const [editingFollowUp, setEditingFollowUp] =
    useState(null);

  const [savingFollowUpEdit, setSavingFollowUpEdit] =
    useState(false);

  /* =====================================================
     SALESPERSON-WISE REMINDERS
  ===================================================== */

  /*
   * Multiple salespersons can use the same browser.
   * Keep the enabled salesperson list separately from the
   * currently selected salesperson shown in the existing UI.
   *
   * The older single-salesperson key is migrated automatically.
   */
  const [notificationSalespersons, setNotificationSalespersons] =
    useState(() => {
      try {
        const saved =
          JSON.parse(
            localStorage.getItem(
              "wfNotificationSalespersons"
            ) || "[]"
          );

        if (Array.isArray(saved)) {
          return saved.filter(Boolean);
        }
      } catch (error) {
        console.error(
          "Notification salesperson restore error:",
          error
        );
      }

      const legacy =
        localStorage.getItem(
          "wfNotificationSalesperson"
        ) || "";

      return legacy ? [legacy] : [];
    });

  const [notificationSalesperson, setNotificationSalesperson] =
    useState(() => {
      const current =
        localStorage.getItem(
          "wfNotificationSalesperson"
        ) || "";

      if (current) {
        return current;
      }

      try {
        const saved =
          JSON.parse(
            localStorage.getItem(
              "wfNotificationSalespersons"
            ) || "[]"
          );

        return Array.isArray(saved)
          ? saved[0] || ""
          : "";
      } catch {
        return "";
      }
    });

  const [notificationsEnabled, setNotificationsEnabled] =
    useState(() => {
      const current =
        localStorage.getItem(
          "wfNotificationSalesperson"
        ) || "";

      try {
        const saved =
          JSON.parse(
            localStorage.getItem(
              "wfNotificationSalespersons"
            ) || "[]"
          );

        if (Array.isArray(saved)) {
          return saved.some(
            (name) =>
              normalizeName(name) ===
              normalizeName(current)
          );
        }
      } catch {
        // Fall back to the legacy single-salesperson key.
      }

      return Boolean(current);
    });

  const [notificationMessage, setNotificationMessage] =
    useState("");

  const [reminderFollowUps, setReminderFollowUps] =
    useState([]);

  const [highlightedFollowUpId, setHighlightedFollowUpId] =
    useState("");

  const checkedReminderIds =
    useRef(new Set());

  /* =====================================================
     FILTERS
  ===================================================== */

  const [customerSearch, setCustomerSearch] =
    useState("");

  const [followUpSearch, setFollowUpSearch] =
    useState("");

  const [
    followUpStatusFilter,
    setFollowUpStatusFilter
  ] = useState("Pending");

  const [
    followUpSalespersonFilter,
    setFollowUpSalespersonFilter
  ] = useState("All");

  /* =====================================================
     LOAD DATA
  ===================================================== */

  const loadData = async () => {
    try {
      setLoading(true);

      const [
        customersResponse,
        followUpsResponse,
        salespersonsResponse
      ] = await Promise.all([
        axios.get(`${API}/customers`),
        axios.get(`${API}/followups`),
        axios.get(`${API}/salespersons`)
      ]);

      setCustomers(
        customersResponse.data || []
      );

      setFollowUps(
        followUpsResponse.data || []
      );

      setSalespersons(
        salespersonsResponse.data || []
      );
    } catch (error) {
      console.error(
        "Load data error:",
        error
      );

      alert(
        error.response?.data?.message ||
          "Unable to load dashboard data."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  /* =====================================================
     SALESPERSON-WISE REMINDER SETUP
  ===================================================== */

  const urlBase64ToUint8Array = (base64String) => {
    const padding = "=".repeat(
      (4 - (base64String.length % 4)) % 4
    );

    const base64 =
      (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    const rawData = window.atob(base64);

    return Uint8Array.from(
      [...rawData].map((char) =>
        char.charCodeAt(0)
      )
    );
  };

  const saveNotificationSalespersons = (names) => {
    const unique = [];

    (Array.isArray(names) ? names : []).forEach((name) => {
      const cleaned = String(name || "").trim();

      if (!cleaned) return;

      if (
        !unique.some(
          (existing) =>
            normalizeName(existing) ===
            normalizeName(cleaned)
        )
      ) {
        unique.push(cleaned);
      }
    });

    localStorage.setItem(
      "wfNotificationSalespersons",
      JSON.stringify(unique)
    );

    return unique;
  };

  const getCurrentPushSubscription = async () => {
    const registration =
      await navigator.serviceWorker.register("/sw.js");

    await navigator.serviceWorker.ready;

    return registration.pushManager.getSubscription();
  };

  const enableNotifications = async () => {
    if (!notificationSalesperson) {
      alert(
        "Please select a salesperson before enabling reminders."
      );
      return;
    }

    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      alert(
        "Browser notifications are not supported in this browser."
      );
      return;
    }

    try {
      const permission =
        await Notification.requestPermission();

      if (permission !== "granted") {
        alert(
          "Notification permission was not granted."
        );
        return;
      }

      const registration =
        await navigator.serviceWorker.register("/sw.js");

      await navigator.serviceWorker.ready;

      const vapidResponse =
        await axios.get(
          `${API}/notifications/vapid-public-key`
        );

      const applicationServerKey =
        urlBase64ToUint8Array(
          vapidResponse.data.publicKey
        );

      let subscription =
        await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription =
          await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey
          });
      }

      const response =
        await axios.post(
          `${API}/notifications/subscribe`,
          {
            salesperson: notificationSalesperson,
            subscription: subscription.toJSON()
          }
        );

      const officialSalesperson =
        response.data?.salesperson ||
        notificationSalesperson;

      setNotificationSalespersons((previous) => {
        const updated = saveNotificationSalespersons([
          ...previous,
          officialSalesperson
        ]);

        return updated;
      });

      localStorage.setItem(
        "wfNotificationSalesperson",
        officialSalesperson
      );

      setNotificationSalesperson(
        officialSalesperson
      );
      setNotificationsEnabled(true);
      setNotificationMessage(
        `Reminders enabled for ${officialSalesperson}.`
      );
    } catch (error) {
      console.error(
        "Notification setup error:",
        error
      );

      alert(
        error.response?.data?.message ||
          "Unable to enable follow-up reminders."
      );
    }
  };

  const disableNotifications = async () => {
    const salespersonToDisable =
      notificationSalesperson;

    if (!salespersonToDisable) return;

    try {
      const subscription =
        await getCurrentPushSubscription();

      if (subscription) {
        await axios.delete(
          `${API}/notifications/subscribe`,
          {
            data: {
              endpoint: subscription.endpoint,
              salesperson: salespersonToDisable
            }
          }
        );
      }

      setNotificationSalespersons((previous) => {
        const updated = previous.filter(
          (name) =>
            normalizeName(name) !==
            normalizeName(salespersonToDisable)
        );

        const saved =
          saveNotificationSalespersons(updated);

        const nextCurrent =
          saved[0] || "";

        if (nextCurrent) {
          localStorage.setItem(
            "wfNotificationSalesperson",
            nextCurrent
          );
        } else {
          localStorage.removeItem(
            "wfNotificationSalesperson"
          );
        }

        setNotificationSalesperson(
          nextCurrent
        );
        setNotificationsEnabled(
          Boolean(nextCurrent)
        );

        return saved;
      });

      setNotificationMessage(
        ""
      );
    } catch (error) {
      console.error(
        "Notification disable error:",
        error
      );
    }
  };

  /* =====================================================
     RESTORE NOTIFICATION STATE AFTER PAGE / BROWSER REOPEN
  ===================================================== */

  useEffect(() => {
    let cancelled = false;

    const restoreNotificationState = async () => {
      if (
        !("Notification" in window) ||
        Notification.permission !== "granted" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) {
        if (!cancelled) {
          setNotificationsEnabled(false);
        }
        return;
      }

      try {
        const subscription =
          await getCurrentPushSubscription();

        if (!subscription) {
          if (!cancelled) {
            setNotificationSalespersons([]);
            setNotificationsEnabled(false);
          }
          return;
        }

        /*
         * MongoDB is the source of truth. The endpoint is
         * unique to this browser/device, while MongoDB can
         * associate that endpoint with many salespersons.
         */
        const response =
          await axios.get(
            `${API}/notifications/subscriptions`,
            {
              params: {
                endpoint: subscription.endpoint
              }
            }
          );

        const serverSalespersons =
          Array.isArray(
            response.data?.salespersons
          )
            ? response.data.salespersons.filter(Boolean)
            : [];

        if (cancelled) return;

        const saved =
          saveNotificationSalespersons(
            serverSalespersons
          );

        if (!saved.length) {
          localStorage.removeItem(
            "wfNotificationSalesperson"
          );
          setNotificationSalesperson("");
          setNotificationsEnabled(false);
          setNotificationMessage("");
          return;
        }

        const savedCurrent =
          localStorage.getItem(
            "wfNotificationSalesperson"
          ) || "";

        const current =
          saved.find(
            (name) =>
              normalizeName(name) ===
              normalizeName(savedCurrent)
          ) || saved[0];

        localStorage.setItem(
          "wfNotificationSalesperson",
          current
        );

        setNotificationSalespersons(saved);
        setNotificationSalesperson(current);
        setNotificationsEnabled(true);
        setNotificationMessage(
          `Reminders enabled for ${current}.`
        );
      } catch (error) {
        console.error(
          "Restore notification state error:",
          error
        );

        /*
         * If the server is temporarily unavailable, retain
         * the locally remembered users instead of deleting
         * them. The next successful restore will reconcile
         * them with MongoDB.
         */
        if (!cancelled) {
          try {
            const local =
              JSON.parse(
                localStorage.getItem(
                  "wfNotificationSalespersons"
                ) || "[]"
              );

            const saved =
              saveNotificationSalespersons(
                Array.isArray(local) ? local : []
              );

            const current =
              saved.find(
                (name) =>
                  normalizeName(name) ===
                  normalizeName(
                    localStorage.getItem(
                      "wfNotificationSalesperson"
                    ) || ""
                  )
              ) || saved[0] || "";

            setNotificationSalesperson(current);
            setNotificationsEnabled(
              Boolean(current)
            );
          } catch {
            setNotificationsEnabled(false);
          }
        }
      }
    };

    restoreNotificationState();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search
    );

    const tab = params.get("tab");
    const followupId =
      params.get("followupId");

    if (tab === "followups") {
      setActiveTab("followups");
    }

    if (followupId) {
      setHighlightedFollowUpId(
        followupId
      );
    }
  }, []);

  useEffect(() => {
    if (!followUps.length) {
      return;
    }

    const getMasterCustomer = (followUp) => {
      return customers.find((customer) =>
        (followUp.customer?._id &&
          String(customer._id) === String(followUp.customer._id)) ||
        (followUp.customer?.customerCode &&
          String(customer.customerCode) === String(followUp.customer.customerCode)) ||
        (!followUp.customer?._id &&
          !followUp.customer?.customerCode &&
          followUp.customer?.name &&
          normalizeName(customer.name) === normalizeName(followUp.customer.name))
      );
    };

    const checkReminders = () => {
      const now = Date.now();
      const enabledSalespersonKeys =
        notificationSalespersons.map(
          (name) => normalizeName(name)
        );

      if (!enabledSalespersonKeys.length) {
        return;
      }

      const reminders = followUps
        .filter((followUp) => {
          const followUpStatus = normalizeName(
            followUp.status
          );

          if (followUpStatus !== "pending") {
            return false;
          }

          const masterCustomer = getMasterCustomer(followUp);

          const customerStatus = normalizeName(
            masterCustomer?.status ||
              followUp.customer?.status ||
              followUp.customerStatus
          );

          if (
            customerStatus === "converted" ||
            customerStatus === "completed" ||
            customerStatus === "complete"
          ) {
            return false;
          }

          if (!followUp.dueAt) {
            return false;
          }

          const dueTime = new Date(followUp.dueAt).getTime();

          if (Number.isNaN(dueTime) || dueTime > now) {
            return false;
          }

          if (
            !enabledSalespersonKeys.includes(
              normalizeName(
                followUp.salesperson
              )
            )
          ) {
            return false;
          }

          const key =
            `wf-followup-reminder-${followUp._id}-${followUp.dueAt}`;

          if (sessionStorage.getItem(key)) {
            return false;
          }

          return true;
        })
        .sort(
          (a, b) =>
            new Date(a.dueAt) - new Date(b.dueAt)
        );

      if (!reminders.length) {
        return;
      }

      reminders.forEach((followUp) => {
        const key =
          `wf-followup-reminder-${followUp._id}-${followUp.dueAt}`;

        sessionStorage.setItem(key, "1");
        checkedReminderIds.current.add(key);
      });

      setReminderFollowUps((previous) => {
        const existingIds = new Set(
          previous.map((item) => String(item._id))
        );

        const newReminders = reminders.filter(
          (item) => !existingIds.has(String(item._id))
        );

        return newReminders.length
          ? [...previous, ...newReminders]
          : previous;
      });
    };

    checkReminders();

    // Check frequently enough that a reminder is not missed when the app
    // stays open around the exact due time.
    const timer = setInterval(
      checkReminders,
      10000
    );

    return () =>
      clearInterval(timer);
  }, [
    followUps,
    customers,
    notificationSalespersons
  ]);

  useEffect(() => {
    if (!highlightedFollowUpId) {
      return;
    }

    setActiveTab("followups");

    const timer = setTimeout(() => {
      document
        .getElementById(
          `followup-row-${highlightedFollowUpId}`
        )
        ?.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
    }, 300);

    return () =>
      clearTimeout(timer);
  }, [
    highlightedFollowUpId,
    followUps
  ]);

  /* =====================================================
     DASHBOARD CALCULATIONS
     SALESPERSON WISE
  ===================================================== */

  const dashboardStats = useMemo(() => {
    const today = getDubaiToday();

    const selectedSalesperson =
      normalizeName(
        dashboardSalespersonFilter
      );

    const matchesSalesperson = (name) => {
      if (
        dashboardSalespersonFilter ===
        "All"
      ) {
        return true;
      }

      return (
        normalizeName(name) ===
        selectedSalesperson
      );
    };

    /* CUSTOMER FILTER */

    const filteredDashboardCustomers =
      customers.filter((customer) =>
        matchesSalesperson(
          customer.assignedSalesperson
        )
      );

    /* FOLLOW-UP FILTER */

    const filteredDashboardFollowUps =
      followUps.filter((followUp) =>
        matchesSalesperson(
          followUp.salesperson
        )
      );

    /* PENDING */

    const pendingFollowUps =
      filteredDashboardFollowUps.filter(
        (followUp) =>
          followUp.status === "Pending"
      );

    /* TODAY */

    const todayFollowUps =
      pendingFollowUps.filter(
        (followUp) =>
          getDubaiDate(
            followUp.dueAt
          ) === today
      );

    /* OVERDUE */

    const overdueFollowUps =
      pendingFollowUps.filter(
        (followUp) =>
          isOverdue(
            followUp.dueAt
          )
      );

    /* COMPLETED */

    const completedFollowUps =
      filteredDashboardFollowUps.filter(
        (followUp) =>
          followUp.status ===
          "Completed"
      );

    /* CONVERTED */

    const convertedCustomers =
      filteredDashboardCustomers.filter(
        (customer) =>
          customer.status ===
          "Converted"
      );
/* CONVERSION*/
const conversionPercentage =
  filteredDashboardCustomers.length === 0
    ? 0
    : (
        (convertedCustomers.length /
          filteredDashboardCustomers.length) *
        100
      ).toFixed(1);

    /* QUOTATION */

    const quotationValue =
      filteredDashboardCustomers.reduce(
        (total, customer) =>
          total +
          Number(
            customer.quotationAmount ||
              0
          ),
        0
      );

    const convertedAmount =
      convertedCustomers.reduce(
        (total, customer) =>
          total +
          Number(
            customer.quotationAmount ||
              0
          ),
        0
      );

    return {
      customers:
        filteredDashboardCustomers.length,

      pending:
        pendingFollowUps.length,

      today:
        todayFollowUps.length,

      overdue:
        overdueFollowUps.length,

      completed:
        completedFollowUps.length,

      converted:
        convertedCustomers.length,

      conversionPercentage,

      quotationAmount:
        quotationValue,

      convertedAmount
    };
  }, [
    customers,
    followUps,
    dashboardSalespersonFilter
  ]);

  /* =====================================================
     CUSTOMER FILTER
  ===================================================== */

  const filteredCustomers = useMemo(() => {
    const search =
      customerSearch
        .trim()
        .toLowerCase();

    if (!search) {
      return customers;
    }

    return customers.filter(
      (customer) =>
        [
          customer.customerCode,
          customer.name,
          customer.phone,
          customer.whatsapp,
          customer.email,
          customer.location,
          customer.assignedSalesperson,
          customer.productInterest,
          customer.status
        ]
          .join(" ")
          .toLowerCase()
          .includes(search)
    );
  }, [
    customers,
    customerSearch
  ]);

  /* =====================================================
     FOLLOW-UP CUSTOMER SEARCH FILTER
  ===================================================== */

  const filteredFollowUpCustomers =
    useMemo(() => {
      const search =
        followUpCustomerSearch
          .trim()
          .toLowerCase();

      if (!search) {
        return [];
      }

      return customers.filter(
        (customer) =>
          [
            customer.customerCode,
            customer.name,
            customer.phone,
            customer.whatsapp,
            customer.email,
            customer.location,
            customer.assignedSalesperson
          ]
            .join(" ")
            .toLowerCase()
            .includes(search)
      );
    }, [
      customers,
      followUpCustomerSearch
    ]);

  /* =====================================================
     FOLLOW-UP FILTER
  ===================================================== */

  const filteredFollowUps =
    useMemo(() => {
      const search =
        followUpSearch
          .trim()
          .toLowerCase();

      return followUps.filter(
        (followUp) => {
          const customerName =
            followUp.customer?.name ||
            "";

          const customerCode =
            followUp.customer
              ?.customerCode || "";

          const salesperson =
            followUp.salesperson ||
            "";

          const matchesSearch =
            !search ||
            [
              customerName,
              customerCode,
              salesperson,
              followUp.type,
              followUp.priority,
              followUp.status,
              followUp.summary,
              followUp.nextAction
            ]
              .join(" ")
              .toLowerCase()
              .includes(search);

          const masterCustomer =
            customers.find((customer) =>
              (followUp.customer?._id &&
                customer._id === followUp.customer._id) ||
              (followUp.customer?.customerCode &&
                customer.customerCode === followUp.customer.customerCode) ||
              (!followUp.customer?._id &&
                !followUp.customer?.customerCode &&
                followUp.customer?.name &&
                normalizeName(customer.name) === normalizeName(followUp.customer.name))
            );

          const customerStatus =
            String(
              masterCustomer?.status ||
              followUp.customer?.status ||
              followUp.customerStatus ||
              ""
            ).trim();

          const customerStatuses = [
            "New",
            "Contacted",
            "Quoted",
            "Negotiation",
            "Converted",
            "Lost",
            "Active"
          ];

          const matchesStatus =
            followUpStatusFilter === "All" ||
            (customerStatuses.includes(followUpStatusFilter)
              ? customerStatus === followUpStatusFilter
              : followUp.status === followUpStatusFilter);

          const matchesSalesperson =
            followUpSalespersonFilter ===
              "All" ||
            normalizeName(
              followUp.salesperson
            ) ===
              normalizeName(
                followUpSalespersonFilter
              );

          return (
            matchesSearch &&
            matchesStatus &&
            matchesSalesperson
          );
        }
      );
    }, [
      followUps,
      followUpSearch,
      followUpStatusFilter,
      followUpSalespersonFilter,
      customers
    ]);

  /* =====================================================
     CUSTOMER FORM HANDLERS
  ===================================================== */

  const handleCustomerChange = (e) => {
    const {
      name,
      value
    } = e.target;

    setCustomerForm((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const saveCustomer = async (e) => {
    e.preventDefault();

    if (
      !customerForm.name.trim()
    ) {
      alert(
        "Customer name is required."
      );
      return;
    }

    try {
      setSavingCustomer(true);

      const payload = {
        ...customerForm,

        quotationAmount:
          Number(
            customerForm.quotationAmount ||
              0
          )
      };

      const response =
        await axios.post(
          `${API}/customers`,
          payload
        );

      setCustomers((prev) => [
        response.data,
        ...prev
      ]);

      setCustomerForm({
        name: "",
        phone: "",
        whatsapp: "",
        email: "",
        location: "",
        source: "Walk-in",
        assignedSalesperson: "",
        status: "New",
        productInterest: "",
        quotationAmount: ""
      });

      await loadData();

      alert(
        "Customer saved successfully."
      );
    } catch (error) {
      console.error(error);

      alert(
        error.response?.data
          ?.message ||
          "Failed to save customer."
      );
    } finally {
      setSavingCustomer(false);
    }
  };

  const isClosedStatus = (status) =>
    ["completed", "complete", "converted"].includes(
      normalizeName(status)
    );

  const isCustomerEditDisabled = (customer) =>
    isClosedStatus(customer?.status);

  const openCustomerEdit = (customer) => {
    if (!customer || isCustomerEditDisabled(customer)) {
      return;
    }

    setEditingCustomer({
      ...customer,
      quotationAmount: customer.quotationAmount ?? 0,
      originalQuotationAmount:
        customer.originalQuotationAmount ??
        customer.quotationAmount ??
        0,
      quotationRevisionRemark:
        customer.quotationRevisionRemark || ''
    });
  };

  const saveCustomerEdit = async (e) => {
    e.preventDefault();

    if (!editingCustomer) return;

    if (isCustomerEditDisabled(editingCustomer)) {
      setEditingCustomer(null);
      alert(
        "This customer cannot be edited because the status is Completed or Converted."
      );
      return;
    }

    try {
      setSavingCustomerEdit(true);

      const response = await axios.patch(
        `${API}/customers/${editingCustomer._id}`,
        {
          ...editingCustomer,
          quotationAmount: Number(
            editingCustomer.quotationAmount || 0
          )
        }
      );

      setCustomers((prev) =>
        prev.map((customer) =>
          customer._id === response.data._id
            ? response.data
            : customer
        )
      );

      setEditingCustomer(null);
      await loadData();
      alert('Customer updated successfully.');
    } catch (error) {
      console.error(error);
      alert(
        error.response?.data?.message ||
          'Failed to update customer.'
      );
    } finally {
      setSavingCustomerEdit(false);
    }
  };

  /* =====================================================
     SALESPERSON HANDLERS
  ===================================================== */

  const handleSalespersonChange =
    (e) => {
      const {
        name,
        value
      } = e.target;

      setSalespersonForm((prev) => ({
        ...prev,
        [name]: value
      }));
    };

  const saveSalesperson = async (
    e
  ) => {
    e.preventDefault();

    if (
      !salespersonForm.name.trim()
    ) {
      alert(
        "Salesperson name is required."
      );
      return;
    }

    try {
      setSavingSalesperson(true);

      const response =
        await axios.post(
          `${API}/salespersons`,
          salespersonForm
        );

      setSalespersons((prev) =>
        [...prev, response.data].sort(
          (a, b) =>
            String(
              a.name || ""
            ).localeCompare(
              String(
                b.name || ""
              )
            )
        )
      );

      setSalespersonForm({
        name: "",
        phone: "",
        location: "",
        status: "Active"
      });

      alert(
        "Salesperson saved successfully."
      );
    } catch (error) {
      console.error(error);

      alert(
        error.response?.data
          ?.message ||
          "Failed to save salesperson."
      );
    } finally {
      setSavingSalesperson(false);
    }
  };

  /* =====================================================
     FOLLOW-UP FORM HANDLERS
  ===================================================== */

  const handleFollowUpChange =
    (e) => {
      const {
        name,
        value
      } = e.target;

      setFollowUpForm((prev) => ({
        ...prev,
        [name]: value
      }));

      if (
        name === "customer" &&
        value
      ) {
        const selectedCustomer =
          customers.find(
            (customer) =>
              customer._id === value
          );

        if (
          selectedCustomer
            ?.assignedSalesperson
        ) {
          setFollowUpForm(
            (prev) => ({
              ...prev,
              customer: value,
              salesperson:
                selectedCustomer.assignedSalesperson
            })
          );
        }
      }
    };

  const saveFollowUp = async (
    e
  ) => {
    e.preventDefault();

    if (
      !followUpForm.customer
    ) {
      alert(
        "Please select a customer."
      );
      return;
    }

    if (
      !followUpForm.dueAt
    ) {
      alert(
        "Please select follow-up date and time."
      );
      return;
    }

    try {
      setSavingFollowUp(true);

      const payload = {
        customer:
          followUpForm.customer,

        salesperson:
          followUpForm.salesperson ||
          "",

        dueAt:
          dubaiLocalToISO(
            followUpForm.dueAt
          ),

        type:
          followUpForm.type ||
          "Call",

        priority:
          followUpForm.priority ||
          "Medium",

        status: "Pending",

        summary:
          followUpForm.summary ||
          "",

        nextAction:
          followUpForm.nextAction ||
          ""
      };

      const response =
        await axios.post(
          `${API}/followups`,
          payload
        );

      setFollowUps((prev) =>
        [...prev, response.data].sort(
          (a, b) =>
            new Date(a.dueAt) -
            new Date(b.dueAt)
        )
      );

      setFollowUpForm({
        customer: "",
        salesperson: "",
        dueAt: "",
        type: "Call",
        priority: "Medium",
        summary: "",
        nextAction: ""
      });

      setFollowUpCustomerSearch("");
      setShowCustomerResults(false);

      await loadData();

      alert(
        "Follow-up saved successfully."
      );
    } catch (error) {
      console.error(error);

      alert(
        error.response?.data
          ?.message ||
          "Failed to save follow-up."
      );
    } finally {
      setSavingFollowUp(false);
    }
  };

  /* =====================================================
     COMPLETE FOLLOW-UP
  ===================================================== */

  const completeFollowUp =
    async (id) => {
      if (!id) return;

      const followUpToComplete =
        followUps.find(
          (followUp) =>
            String(followUp._id) === String(id)
        );

      if (!followUpToComplete) {
        return;
      }

      const masterCustomer =
        customers.find((customer) =>
          (followUpToComplete.customer?._id &&
            String(customer._id) ===
              String(followUpToComplete.customer._id)) ||
          (followUpToComplete.customer?.customerCode &&
            String(customer.customerCode) ===
              String(followUpToComplete.customer.customerCode)) ||
          (!followUpToComplete.customer?._id &&
            !followUpToComplete.customer?.customerCode &&
            followUpToComplete.customer?.name &&
            normalizeName(customer.name) ===
              normalizeName(followUpToComplete.customer.name))
        );

      if (
        normalizeName(followUpToComplete.status) !== "pending" ||
        isClosedStatus(
          masterCustomer?.status ||
            followUpToComplete.customer?.status ||
            followUpToComplete.customerStatus
        )
      ) {
        alert(
          "This follow-up cannot be completed because the follow-up or customer is already Completed or Converted."
        );
        return;
      }

      try {
        setCompletingId(id);

        const response =
          await axios.patch(
            `${API}/followups/${id}`,
            {
              status:
                "Completed"
            }
          );

        setFollowUps((prev) =>
          prev.map(
            (followUp) =>
              followUp._id === id
                ? response.data
                : followUp
          )
        );

        await loadData();
      } catch (error) {
        console.error(error);

        alert(
          error.response?.data
            ?.message ||
            "Failed to complete follow-up."
        );
      } finally {
        setCompletingId(null);
      }
    };

  /* =====================================================
     OPEN FOLLOW-UP EDIT
  ===================================================== */

  const openFollowUpEdit =
    (followUp) => {
      if (!followUp) return;

      const masterCustomer =
        customers.find((customer) =>
          (followUp.customer?._id &&
            String(customer._id) ===
              String(followUp.customer._id)) ||
          (followUp.customer?.customerCode &&
            String(customer.customerCode) ===
              String(followUp.customer.customerCode)) ||
          (!followUp.customer?._id &&
            !followUp.customer?.customerCode &&
            followUp.customer?.name &&
            normalizeName(customer.name) ===
              normalizeName(followUp.customer.name))
        );

      if (
        isClosedStatus(followUp.status) ||
        isClosedStatus(
          masterCustomer?.status ||
            followUp.customer?.status ||
            followUp.customerStatus
        )
      ) {
        return;
      }

      setEditingFollowUp({
        _id:
          followUp._id,

        customer:
          followUp.customer,

        salesperson:
          followUp.salesperson ||
          "",

        dueAt:
          isoToDubaiLocal(
            followUp.dueAt
          ),

        type:
          followUp.type ||
          "Call",

        status:
          followUp.status ||
          "Pending",

        priority:
          followUp.priority ||
          "Medium",

        summary:
          followUp.summary ||
          "",

        nextAction:
          followUp.nextAction ||
          ""
      });
    };

  /* =====================================================
     EDIT FOLLOW-UP CHANGE
  ===================================================== */

  const handleEditFollowUpChange =
    (e) => {
      const {
        name,
        value
      } = e.target;

      setEditingFollowUp(
        (prev) => ({
          ...prev,
          [name]: value
        })
      );
    };

  /* =====================================================
     SAVE FOLLOW-UP EDIT
  ===================================================== */

  const saveFollowUpEdit =
    async () => {
      if (!editingFollowUp) {
        return;
      }

      const masterCustomer =
        customers.find((customer) =>
          (editingFollowUp.customer?._id &&
            String(customer._id) ===
              String(editingFollowUp.customer._id)) ||
          (editingFollowUp.customer?.customerCode &&
            String(customer.customerCode) ===
              String(editingFollowUp.customer.customerCode)) ||
          (!editingFollowUp.customer?._id &&
            !editingFollowUp.customer?.customerCode &&
            editingFollowUp.customer?.name &&
            normalizeName(customer.name) ===
              normalizeName(editingFollowUp.customer.name))
        );

      if (
        isClosedStatus(editingFollowUp.status) ||
        isClosedStatus(
          masterCustomer?.status ||
            editingFollowUp.customer?.status ||
            editingFollowUp.customerStatus
        )
      ) {
        setEditingFollowUp(null);
        alert(
          "This follow-up cannot be edited because the follow-up or customer is already Completed or Converted."
        );
        return;
      }

      if (
        !editingFollowUp.dueAt
      ) {
        alert(
          "Follow-up date and time are required."
        );
        return;
      }

      try {
        setSavingFollowUpEdit(
          true
        );

        const payload = {
          dueAt:
            dubaiLocalToISO(
              editingFollowUp.dueAt
            ),

          salesperson:
            editingFollowUp.salesperson ||
            "",

          type:
            editingFollowUp.type ||
            "Call",

          status:
            editingFollowUp.status ||
            "Pending",

          priority:
            editingFollowUp.priority ||
            "Medium",

          summary:
            editingFollowUp.summary ||
            "",

          nextAction:
            editingFollowUp.nextAction ||
            ""
        };

        const response =
          await axios.patch(
            `${API}/followups/${editingFollowUp._id}`,
            payload
          );

        setFollowUps((prev) =>
          prev
            .map(
              (followUp) =>
                followUp._id ===
                editingFollowUp._id
                  ? response.data
                  : followUp
            )
            .sort(
              (a, b) =>
                new Date(a.dueAt) -
                new Date(b.dueAt)
            )
        );

        setEditingFollowUp(
          null
        );

        await loadData();

        alert(
          "Follow-up updated successfully."
        );
      } catch (error) {
        console.error(error);

        alert(
          error.response?.data
            ?.message ||
            "Failed to update follow-up."
        );
      } finally {
        setSavingFollowUpEdit(
          false
        );
      }
    };

  /* =====================================================
     LOADING
  ===================================================== */

  if (loading) {
    return (
      <div className="app">
        <div className="loading">
          Loading dashboard...
        </div>
      </div>
    );
  }

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <div className="app">

      {/* =================================================
          HEADER
      ================================================= */}

      <header className="app-header">

        <div>
          <h1>
            Western Furniture CRM
          </h1>

          <p>
            Customer Follow-up Dashboard
          </p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
            justifyContent: "flex-end"
          }}
        >

          <select
            value={notificationSalesperson}
            onChange={(e) => {
              const selected = e.target.value;

              setNotificationSalesperson(selected);
              setNotificationsEnabled(
                notificationSalespersons.some(
                  (name) =>
                    normalizeName(name) ===
                    normalizeName(selected)
                )
              );
              setNotificationMessage("");

              if (selected) {
                localStorage.setItem(
                  "wfNotificationSalesperson",
                  selected
                );
              }
            }}
            style={{
              padding: "9px 12px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              minWidth: "180px"
            }}
          >
            <option value="">
              Reminder Salesperson
            </option>

            {salespersons
              .filter(
                (salesperson) =>
                  salesperson.status === "Active"
              )
              .map((salesperson) => (
                <option
                  key={salesperson._id}
                  value={salesperson.name}
                >
                  {salesperson.name}
                </option>
              ))}
          </select>

          {notificationsEnabled ? (
            <button
              className="btn btn-secondary"
              onClick={disableNotifications}
            >
              🔔 {notificationSalesperson}
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={enableNotifications}
            >
              🔔 Enable Notifications
            </button>
          )}

          <button
            className="btn btn-secondary"
            onClick={loadData}
          >
            Refresh
          </button>

        </div>

      </header>

      {/* =================================================
          NAVIGATION
      ================================================= */}

      <nav className="tabs">

        <button
          className={
            activeTab ===
            "dashboard"
              ? "tab active"
              : "tab"
          }
          onClick={() =>
            setActiveTab(
              "dashboard"
            )
          }
        >
          Dashboard
        </button>

        <button
          className={
            activeTab ===
            "salespersons"
              ? "tab active"
              : "tab"
          }
          onClick={() =>
            setActiveTab(
              "salespersons"
            )
          }
        >
          Salesperson Master
        </button>

        <button
          className={
            activeTab ===
            "customers"
              ? "tab active"
              : "tab"
          }
          onClick={() =>
            setActiveTab(
              "customers"
            )
          }
        >
          Customers
        </button>

        <button
          className={
            activeTab ===
            "followups"
              ? "tab active"
              : "tab"
          }
          onClick={() =>
            setActiveTab(
              "followups"
            )
          }
        >
          Follow-ups
        </button>

      </nav>

      <main className="content">

        {/* =================================================
            DASHBOARD
        ================================================= */}

        {activeTab ===
          "dashboard" && (
          <section>

            <div className="page-header dashboard-page-header">

              <div>
                <h2>
                  Dashboard
                </h2>

                <p>
                  Customer and
                  follow-up overview
                </p>
              </div>

              {/* SALESPERSON FILTER */}

              <div className="dashboard-filter">

                <label>
                  Salesperson
                </label>

                <select
                  value={
                    dashboardSalespersonFilter
                  }
                  onChange={(e) =>
                    setDashboardSalespersonFilter(
                      e.target.value
                    )
                  }
                >

                  <option value="All">
                    All Salespersons
                  </option>

                  {salespersons
                    .filter(
                      (sp) =>
                        sp.status ===
                        "Active"
                    )
                    .map(
                      (sp) => (
                        <option
                          key={
                            sp._id
                          }
                          value={
                            sp.name
                          }
                        >
                          {sp.name}
                        </option>
                      )
                    )}

                </select>

              </div>

            </div>

            {/* KPI CARDS */}

            <div className="stats-grid">

              <StatCard
                title="Customers"
                value={
                  dashboardStats.customers
                }
              />

              <StatCard
                title="Pending Follow-ups"
                value={
                  dashboardStats.pending
                }
              />

              <StatCard
                title="Due Today"
                value={
                  dashboardStats.today
                }
              />

              <StatCard
                title="Overdue"
                value={
                  dashboardStats.overdue
                }
              />

              <StatCard
                title="Completed"
                value={
                  dashboardStats.completed
                }
              />

              <StatCard
                title="Converted"
                value={
                  dashboardStats.converted
                }
              />

              <StatCard
                title="Conversion Rate"
                value={`${dashboardStats.conversionPercentage}%`}
              />

              <StatCard
                title="Quotation Value"
                value={`AED ${dashboardStats.quotationAmount.toLocaleString(
                  "en-AE",
                  {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2
                  }
                )}`}
              />

              <StatCard
                title="Converted Amount"
                value={`AED ${dashboardStats.convertedAmount.toLocaleString(
                  "en-AE",
                  {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2
                  }
                )}`}
              />

            </div>

            {/* DASHBOARD SUMMARY */}

            <div className="dashboard-grid">

              <div className="card">

                <div className="card-header">
                  <h3>
                    Follow-up Summary
                  </h3>
                </div>

                <div className="summary-list">

                  <div className="summary-row">
                    <span>
                      Pending
                    </span>

                    <strong>
                      {
                        dashboardStats.pending
                      }
                    </strong>
                  </div>

                  <div className="summary-row">
                    <span>
                      Due Today
                    </span>

                    <strong>
                      {
                        dashboardStats.today
                      }
                    </strong>
                  </div>

                  <div className="summary-row">
                    <span>
                      Overdue
                    </span>

                    <strong>
                      {
                        dashboardStats.overdue
                      }
                    </strong>
                  </div>

                  <div className="summary-row">
                    <span>
                      Completed
                    </span>

                    <strong>
                      {
                        dashboardStats.completed
                      }
                    </strong>
                  </div>

                </div>
              </div>

              <div className="card">

                <div className="card-header">
                  <h3>
                    Customer Summary
                  </h3>
                </div>

                <div className="summary-list">

                  <div className="summary-row">
                    <span>
                      Total Customers
                    </span>

                    <strong>
                      {
                        dashboardStats.customers
                      }
                    </strong>
                  </div>

                  <div className="summary-row">
                    <span>
                      Converted
                    </span>

                    <strong>
                      {
                        dashboardStats.converted
                      }
                    </strong>
                  </div>

                  <div className="summary-row">
                    <span>
                      Quotation Value
                    </span>

                    <strong>
                      AED{" "}
                      {dashboardStats.quotationAmount.toLocaleString(
                        "en-AE"
                      )}
                    </strong>
                  </div>

                  <div className="summary-row">
                    <span>
                      Converted Amount
                    </span>

                    <strong>
                      AED{" "}
                      {dashboardStats.convertedAmount.toLocaleString(
                        "en-AE"
                      )}
                    </strong>
                  </div>

                </div>

              </div>

            </div>

          </section>
        )}

        {/* =================================================
            SALESPERSON MASTER
        ================================================= */}

        {activeTab ===
          "salespersons" && (
          <section>

            <div className="page-header">

              <div>
                <h2>
                  Salesperson Master
                </h2>

                <p>
                  Manage active
                  salespersons
                </p>
              </div>

            </div>

            <div className="card">

              <div className="card-header">
                <h3>
                  Add Salesperson
                </h3>
              </div>

              <form
                className="form-grid"
                onSubmit={
                  saveSalesperson
                }
              >

                <div className="form-group">

                  <label>
                    Name
                  </label>

                  <input
                    name="name"
                    value={
                      salespersonForm.name
                    }
                    onChange={
                      handleSalespersonChange
                    }
                    placeholder="Salesperson name"
                    required
                  />

                </div>

                {/* PHONE */}

                <div className="form-group">

                  <label>
                    Phone
                  </label>

                  <input
                    name="phone"
                    value={
                      salespersonForm.phone
                    }
                    onChange={
                      handleSalespersonChange
                    }
                    placeholder="Phone number"
                  />

                </div>

                {/* EDITABLE LOCATION COMBO */}

                <div className="form-group">

                  <label>
                    Location
                  </label>

                  <input
                    list="salesperson-locations"
                    name="location"
                    value={
                      salespersonForm.location
                    }
                    onChange={
                      handleSalespersonChange
                    }
                    placeholder="Select or enter location"
                  />

                  <datalist id="salesperson-locations">

                    <option value="Natuzzi Zabeel" />

                    <option value="Natuzzi Mega Store" />

                    <option value="ADH Galleria" />

                  </datalist>

                </div>

                <div className="form-group">

                  <label>
                    Status
                  </label>

                  <select
                    name="status"
                    value={
                      salespersonForm.status
                    }
                    onChange={
                      handleSalespersonChange
                    }
                  >

                    <option value="Active">
                      Active
                    </option>

                    <option value="Inactive">
                      Inactive
                    </option>

                  </select>

                </div>

                <div className="form-actions">

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={
                      savingSalesperson
                    }
                  >
                    {savingSalesperson
                      ? "Saving..."
                      : "Add Salesperson"}
                  </button>

                </div>

              </form>

            </div>

            <div className="card">

              <div className="card-header">

                <h3>
                  Salespersons (
                  {
                    salespersons.length
                  }
                  )
                </h3>

              </div>

              <div className="table-wrapper">

                <table>

                  <thead>

                    <tr>
                      <th>
                        Code
                      </th>

                      <th>
                        Name
                      </th>

                      <th>
                        Phone
                      </th>

                      <th>
                        Location
                      </th>

                      <th>
                        Status
                      </th>
                    </tr>

                  </thead>

                  <tbody>

                    {salespersons.map(
                      (salesperson) => (
                        <tr
                          key={
                            salesperson._id
                          }
                        >

                          <td>
                            {
                              salesperson.salespersonCode
                            }
                          </td>

                          <td>
                            {
                              salesperson.name
                            }
                          </td>

                          <td>
                            {
                              salesperson.phone ||
                              "-"
                            }
                          </td>

                          <td>
                            {
                              salesperson.location ||
                              "-"
                            }
                          </td>

                          <td>

                            <Badge
                              type={
                                salesperson.status ===
                                "Active"
                                  ? "success"
                                  : "warning"
                              }
                            >
                              {
                                salesperson.status
                              }
                            </Badge>

                          </td>

                        </tr>
                      )
                    )}

                  </tbody>

                </table>

              </div>

            </div>

          </section>
        )}

        {/* =================================================
            CUSTOMERS
        ================================================= */}

        {activeTab ===
          "customers" && (
          <section>

            <div className="page-header">

              <div>

                <h2>
                  Customers
                </h2>

                <p>
                  Customer master and
                  quotation information
                </p>

              </div>

            </div>

            <div className="card">

              <div className="card-header">

                <h3>
                  Add Customer
                </h3>

              </div>

              <form
                className="form-grid"
                onSubmit={
                  saveCustomer
                }
              >

                <div className="form-group">

                  <label>
                    Name
                  </label>

                  <input
                    name="name"
                    value={
                      customerForm.name
                    }
                    onChange={
                      handleCustomerChange
                    }
                    placeholder="Customer name"
                    required
                  />

                </div>

                <div className="form-group">

                  <label>
                    Phone
                  </label>

                  <input
                    name="phone"
                    value={
                      customerForm.phone
                    }
                    onChange={
                      handleCustomerChange
                    }
                  />

                </div>

                <div className="form-group">

                  <label>
                    WhatsApp
                  </label>

                  <input
                    name="whatsapp"
                    value={
                      customerForm.whatsapp
                    }
                    onChange={
                      handleCustomerChange
                    }
                  />

                </div>

                <div className="form-group">

                  <label>
                    Email
                  </label>

                  <input
                    type="email"
                    name="email"
                    value={
                      customerForm.email
                    }
                    onChange={
                      handleCustomerChange
                    }
                  />

                </div>

                <div className="form-group">

                  <label>
                    Location
                  </label>

                  <input
                    name="location"
                    value={
                      customerForm.location
                    }
                    onChange={
                      handleCustomerChange
                    }
                  />

                </div>

                <div className="form-group">

                  <label>
                    Source
                  </label>

                  <select
                    name="source"
                    value={
                      customerForm.source
                    }
                    onChange={
                      handleCustomerChange
                    }
                  >

                    <option value="Walk-in">
                      Walk-in
                    </option>

                    <option value="Referral">
                      Referral
                    </option>

                    <option value="Website">
                      Website
                    </option>

                    <option value="Social Media">
                      Social Media
                    </option>

                    <option value="Existing Customer">
                      Existing Customer
                    </option>

                    <option value="Other">
                      Other
                    </option>

                  </select>

                </div>

                <div className="form-group">

                  <label>
                    Salesperson
                  </label>

                  <select
                    name="assignedSalesperson"
                    value={
                      customerForm.assignedSalesperson
                    }
                    onChange={
                      handleCustomerChange
                    }
                  >

                    <option value="">
                      Select Salesperson
                    </option>

                    {salespersons
                      .filter(
                        (sp) =>
                          sp.status ===
                          "Active"
                      )
                      .map(
                        (sp) => (
                          <option
                            key={
                              sp._id
                            }
                            value={
                              sp.name
                            }
                          >
                            {
                              sp.name
                            }
                          </option>
                        )
                      )}

                  </select>

                </div>

                <div className="form-group">

                  <label>
                    Status
                  </label>

                  <select
                    name="status"
                    value={
                      customerForm.status
                    }
                    onChange={
                      handleCustomerChange
                    }
                  >

                    <option value="New">
                      New
                    </option>

                    <option value="Contacted">
                      Contacted
                    </option>

                    <option value="Quoted">
                      Quoted
                    </option>

                    <option value="Negotiation">
                      Negotiation
                    </option>

                    <option value="Converted">
                      Converted
                    </option>

                    <option value="Lost">
                      Lost
                    </option>

                    <option value="Active">
                      Active
                    </option>

                  </select>

                </div>

                <div className="form-group">

                  <label>
                    Product Interest
                  </label>

                  <input
                    name="productInterest"
                    value={
                      customerForm.productInterest
                    }
                    onChange={
                      handleCustomerChange
                    }
                  />

                </div>

                <div className="form-group">

                  <label>
                    Quotation Amount
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    name="quotationAmount"
                    value={
                      customerForm.quotationAmount
                    }
                    onChange={
                      handleCustomerChange
                    }
                    placeholder="AED"
                  />

                </div>

                <div className="form-actions">

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={
                      savingCustomer
                    }
                  >
                    {savingCustomer
                      ? "Saving..."
                      : "Add Customer"}
                  </button>

                </div>

              </form>

            </div>

            <div className="card">

              <div className="card-header">

                <h3>
                  Customer Directory (
                  {
                    filteredCustomers.length
                  }
                  )
                </h3>

                <input
                  className="search-input"
                  value={
                    customerSearch
                  }
                  onChange={(e) =>
                    setCustomerSearch(
                      e.target.value
                    )
                  }
                  placeholder="Search customers..."
                />

              </div>

              <div className="table-wrapper">

                <table>

                  <thead>

                    <tr>
                      <th>
                        Code
                      </th>

                      <th>
                        Name
                      </th>

                      <th>
                        Phone
                      </th>

                      <th>
                        Location
                      </th>

                      <th>
                        Source
                      </th>

                      <th>
                        Salesperson
                      </th>

                      <th>
                        Status
                      </th>

                      <th>
                        Product
                      </th>

                      <th>
                        Quotation
                      </th>

                      <th>
                        Action
                      </th>
                    </tr>

                  </thead>

                  <tbody>

                    {filteredCustomers.length ===
                    0 ? (
                      <tr>

                        <td
                          colSpan="11"
                          className="empty"
                        >
                          No customers
                          found.
                        </td>

                      </tr>
                    ) : (
                      filteredCustomers.map(
                        (customer) => (
                          <tr
                            key={
                              customer._id
                            }
                          >

                            <td>
                              {
                                customer.customerCode
                              }
                            </td>

                            <td>
                              {
                                customer.name
                              }
                            </td>

                            <td>
                              {
                                customer.phone ||
                                "-"
                              }
                            </td>

                            <td>
                              {
                                customer.location ||
                                "-"
                              }
                            </td>

                            <td>
                              {
                                customer.source ||
                                "-"
                              }
                            </td>

                            <td>
                              {
                                customer.assignedSalesperson ||
                                "-"
                              }
                            </td>

                            <td>

                              <Badge>
                                {
                                  customer.status
                                }
                              </Badge>

                            </td>

                            <td>
                              {
                                customer.productInterest ||
                                "-"
                              }
                            </td>

                            <td>
                              AED{" "}
                              {Number(
                                customer.quotationAmount ||
                                  0
                              ).toLocaleString(
                                "en-AE",
                                {
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 2
                                }
                              )}
                            </td>

                            <td>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() =>
                                  openCustomerEdit(customer)
                                }
                                disabled={
                                  isCustomerEditDisabled(customer)
                                }
                              >
                                Edit
                              </button>
                            </td>

                          </tr>
                        )
                      )
                    )}

                  </tbody>

                </table>

              </div>

            </div>

          </section>
        )}

        {/* =================================================
            FOLLOW-UPS
        ================================================= */}

        {activeTab ===
          "followups" && (
          <section>

            <div className="page-header">

              <div>

                <h2>
                  Follow-ups
                </h2>

                <p>
                  Schedule and manage
                  customer follow-ups
                </p>

              </div>

            </div>

            <div className="card">

              <div className="card-header">

                <h3>
                  Schedule Follow-up
                </h3>

              </div>

              <form
                className="form-grid"
                onSubmit={
                  saveFollowUp
                }
              >

                {/* CUSTOMER SEARCH */}

                <div
                  className="form-group"
                  style={{
                    position: "relative"
                  }}
                >

                  <label>
                    Customer
                  </label>

                  <input
                    type="text"
                    value={
                      followUpCustomerSearch
                    }
                    onChange={(e) => {
                      const value =
                        e.target.value;

                      setFollowUpCustomerSearch(
                        value
                      );

                      if (
                        !value.trim()
                      ) {
                        setFollowUpForm(
                          (prev) => ({
                            ...prev,
                            customer: "",
                            salesperson: ""
                          })
                        );

                        setShowCustomerResults(
                          false
                        );

                        return;
                      }

                      setFollowUpForm(
                        (prev) => ({
                          ...prev,
                          customer: "",
                          salesperson: ""
                        })
                      );

                      setShowCustomerResults(
                        true
                      );
                    }}
                    onFocus={() => {
                      if (
                        followUpCustomerSearch.trim()
                      ) {
                        setShowCustomerResults(
                          true
                        );
                      }
                    }}
                    placeholder="Search customer..."
                    required={
                      !followUpForm.customer
                    }
                  />

                  {followUpForm.customer && (
                    <small className="muted">
                      Selected:{" "}
                      {customers.find(
                        (customer) =>
                          customer._id ===
                          followUpForm.customer
                      )?.customerCode || ""}
                    </small>
                  )}

                  {showCustomerResults &&
                    followUpCustomerSearch.trim() && (
                      <div
                        className="customer-search-results"
                        onMouseDown={(e) =>
                          e.preventDefault()
                        }
                      >

                        {filteredFollowUpCustomers.length ===
                        0 ? (
                          <div className="customer-search-empty">
                            No customers found
                          </div>
                        ) : (
                          filteredFollowUpCustomers.map(
                            (customer) => (
                              <div
                                key={
                                  customer._id
                                }
                                className="customer-search-item"
                                onClick={() => {

                                  setFollowUpForm(
                                    (prev) => ({
                                      ...prev,
                                      customer:
                                        customer._id,
                                      salesperson:
                                        customer.assignedSalesperson ||
                                        ""
                                    })
                                  );

                                  setFollowUpCustomerSearch(
                                    `${customer.customerCode} - ${customer.name}`
                                  );

                                  setShowCustomerResults(
                                    false
                                  );

                                }}
                              >

                                <strong>
                                  {
                                    customer.customerCode
                                  }{" "}
                                  -{" "}
                                  {
                                    customer.name
                                  }
                                </strong>

                                <div className="muted">

                                  {
                                    customer.phone ||
                                    ""
                                  }

                                  {customer.phone &&
                                  customer.assignedSalesperson
                                    ? " • "
                                    : ""}

                                  {
                                    customer.assignedSalesperson ||
                                    ""
                                  }

                                </div>

                              </div>
                            )
                          )
                        )}

                      </div>
                    )}

                </div>

                <div className="form-group">

                  <label>
                    Salesperson
                  </label>

                  <select
                    name="salesperson"
                    value={
                      followUpForm.salesperson
                    }
                    onChange={
                      handleFollowUpChange
                    }
                  >

                    <option value="">
                      Select Salesperson
                    </option>

                    {salespersons
                      .filter(
                        (sp) =>
                          sp.status ===
                          "Active"
                      )
                      .map(
                        (sp) => (
                          <option
                            key={
                              sp._id
                            }
                            value={
                              sp.name
                            }
                          >
                            {
                              sp.name
                            }
                          </option>
                        )
                      )}

                  </select>

                </div>

                <div className="form-group">

                  <label>
                    Date & Time
                  </label>

                  <input
                    type="datetime-local"
                    name="dueAt"
                    value={
                      followUpForm.dueAt
                    }
                    onChange={
                      handleFollowUpChange
                    }
                    required
                  />

                </div>

                <div className="form-group">

                  <label>
                    Type
                  </label>

                  <select
                    name="type"
                    value={
                      followUpForm.type
                    }
                    onChange={
                      handleFollowUpChange
                    }
                  >

                    <option value="Call">
                      Call
                    </option>

                    <option value="WhatsApp">
                      WhatsApp
                    </option>

                    <option value="Email">
                      Email
                    </option>

                    <option value="Visit">
                      Visit
                    </option>

                    <option value="Meeting">
                      Meeting
                    </option>

                  </select>

                </div>

                <div className="form-group">

                  <label>
                    Priority
                  </label>

                  <select
                    name="priority"
                    value={
                      followUpForm.priority
                    }
                    onChange={
                      handleFollowUpChange
                    }
                  >

                    <option value="Low">
                      Low
                    </option>

                    <option value="Medium">
                      Medium
                    </option>

                    <option value="High">
                      High
                    </option>

                    <option value="Urgent">
                      Urgent
                    </option>

                  </select>

                </div>

                <div className="form-group full-width">

                  <label>
                    Summary
                  </label>

                  <textarea
                    name="summary"
                    value={
                      followUpForm.summary
                    }
                    onChange={
                      handleFollowUpChange
                    }
                    rows="3"
                    placeholder="Enter follow-up summary..."
                  />

                </div>

                <div className="form-group full-width">

                  <label>
                    Next Action
                  </label>

                  <textarea
                    name="nextAction"
                    value={
                      followUpForm.nextAction
                    }
                    onChange={
                      handleFollowUpChange
                    }
                    rows="3"
                    placeholder="Enter next action..."
                  />

                </div>

                <div className="form-actions">

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={
                      savingFollowUp
                    }
                  >
                    {savingFollowUp
                      ? "Saving..."
                      : "Schedule Follow-up"}
                  </button>

                </div>

              </form>

            </div>

            <div className="card">

              <div className="card-header">

                <h3>
                  Follow-up List (
                  {
                    filteredFollowUps.length
                  }
                  )
                </h3>

              </div>

              <div className="filters">

                <input
                  className="search-input"
                  value={
                    followUpSearch
                  }
                  onChange={(e) =>
                    setFollowUpSearch(
                      e.target.value
                    )
                  }
                  placeholder="Search follow-ups..."
                />

                <select
                  value={
                    followUpStatusFilter
                  }
                  onChange={(e) =>
                    setFollowUpStatusFilter(
                      e.target.value
                    )
                  }
                >

                  <option value="Pending">
                    Pending
                  </option>

                  <option value="Completed">
                    Completed
                  </option>

                  <option value="New">
                    New
                  </option>

                  <option value="Contacted">
                    Contacted
                  </option>

                  <option value="Quoted">
                    Quoted
                  </option>

                  <option value="Negotiation">
                    Negotiation
                  </option>

                  <option value="Converted">
                    Converted
                  </option>

                  <option value="Lost">
                    Lost
                  </option>

                  <option value="Active">
                    Active
                  </option>

                </select>

                <select
                  value={
                    followUpSalespersonFilter
                  }
                  onChange={(e) =>
                    setFollowUpSalespersonFilter(
                      e.target.value
                    )
                  }
                >

                  <option value="All">
                    All Salespersons
                  </option>

                  {salespersons
                    .filter(
                      (sp) =>
                        sp.status ===
                        "Active"
                    )
                    .map(
                      (sp) => (
                        <option
                          key={
                            sp._id
                          }
                          value={
                            sp.name
                          }
                        >
                          {
                            sp.name
                          }
                        </option>
                      )
                    )}

                </select>

              </div>

              <div className="table-wrapper">

                <table>

                  <thead>

                    <tr>

                      <th>
                        Customer
                      </th>

                      <th>
                        Salesperson
                      </th>

                      <th>
                        Date & Time
                      </th>

                      <th>
                        Type
                      </th>

                      <th>
                        Priority
                      </th>

                      <th>
                        Follow-up Stage
                      </th>

                      <th>
                        Customer Status
                      </th>

                      <th>
                        Follow-up Status
                      </th>

                      <th>
                        Summary
                      </th>

                      <th>
                        Next Action
                      </th>

                      <th>
                        Action
                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    {filteredFollowUps.length ===
                    0 ? (
                      <tr>

                        <td
                          colSpan="11"
                          className="empty"
                        >
                          No follow-ups
                          found.
                        </td>

                      </tr>

                    ) : (
                      filteredFollowUps.map(
                        (followUp) => {

                          const overdue =
                            followUp.status ===
                              "Pending" &&
                            isOverdue(
                              followUp.dueAt
                            );

                          const masterCustomer =
                            customers.find((customer) =>
                              (followUp.customer?._id &&
                                customer._id === followUp.customer._id) ||
                              (followUp.customer?.customerCode &&
                                customer.customerCode === followUp.customer.customerCode) ||
                              (!followUp.customer?._id &&
                                !followUp.customer?.customerCode &&
                                followUp.customer?.name &&
                                normalizeName(customer.name) === normalizeName(followUp.customer.name))
                            );

                          const customerStatus =
                            String(
                              masterCustomer?.status ||
                              followUp.customer?.status ||
                              followUp.customerStatus ||
                              "-"
                            ).trim();

                          const isFollowUpEditDisabled =
                            isClosedStatus(followUp.status) ||
                            isClosedStatus(customerStatus);

                          const customerKey =
                            followUp.customer?._id ||
                            followUp.customer?.customerCode ||
                            followUp.customer?.name ||
                            followUp.customerName ||
                            "";

                          const customerFollowUps =
                            followUps
                              .filter((item) => {
                                const itemCustomerKey =
                                  item.customer?._id ||
                                  item.customer?.customerCode ||
                                  item.customer?.name ||
                                  item.customerName ||
                                  "";

                                return (
                                  itemCustomerKey ===
                                  customerKey
                                );
                              })
                              .sort(
                                (a, b) =>
                                  new Date(a.dueAt) -
                                  new Date(b.dueAt)
                              );

                          const followUpStageIndex =
                            customerFollowUps.findIndex(
                              (item) =>
                                item._id ===
                                followUp._id
                            );

                          const followUpStage =
                            followUpStageIndex >= 0
                              ? `${followUpStageIndex + 1}${
                                  followUpStageIndex + 1 === 1
                                    ? "st"
                                    : followUpStageIndex + 1 === 2
                                    ? "nd"
                                    : followUpStageIndex + 1 === 3
                                    ? "rd"
                                    : "th"
                                } Follow-up`
                              : "Follow-up";

                          return (
                            <tr
                              key={
                                followUp._id
                              }
                              id={
                                `followup-row-${followUp._id}`
                              }
                              className={
                                overdue
                                  ? "overdue-row"
                                  : highlightedFollowUpId ===
                                    followUp._id
                                  ? "highlighted-row"
                                  : ""
                              }
                            >

                              <td>

                                <strong>
                                  {
                                    followUp
                                      .customer
                                      ?.name
                                  }
                                </strong>

                                <div className="muted">
                                  {
                                    followUp
                                      .customer
                                      ?.customerCode
                                  }
                                </div>

                              </td>

                              <td>
                                {
                                  followUp.salesperson ||
                                  "-"
                                }
                              </td>

                              <td>

                                {
                                  fmt(
                                    followUp.dueAt
                                  )
                                }

                                {overdue && (
                                  <div>

                                    <Badge type="danger">
                                      Overdue
                                    </Badge>

                                  </div>
                                )}

                              </td>

                              <td>

                                <Badge>
                                  {
                                    followUp.type
                                  }
                                </Badge>

                              </td>

                              <td>

                                <Badge>
                                  {
                                    followUp.priority
                                  }
                                </Badge>

                              </td>

                              <td>

                                <Badge>
                                  {followUpStage}
                                </Badge>

                              </td>

                              <td>

                                <Badge>
                                  {
                                    customerStatus ||
                                    "-"
                                  }
                                </Badge>

                              </td>

                              <td>

                                <Badge
                                  type={
                                    followUp.status ===
                                    "Completed"
                                      ? "success"
                                      : "warning"
                                  }
                                >
                                  {
                                    followUp.status ||
                                    "Pending"
                                  }
                                </Badge>

                              </td>

                              <td>
                                {
                                  followUp.summary ||
                                  "-"
                                }
                              </td>

                              <td>
                                {
                                  followUp.nextAction ||
                                  "-"
                                }
                              </td>

                              <td>

                                <div className="action-buttons">

                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() =>
                                      openFollowUpEdit(
                                        followUp
                                      )
                                    }
                                    disabled={
                                      isFollowUpEditDisabled
                                    }
                                  >
                                    Edit
                                  </button>

                                  {followUp.status ===
                                    "Pending" &&
                                    !isClosedStatus(customerStatus) && (
                                    <button
                                      type="button"
                                      className="btn btn-success"
                                      onClick={() =>
                                        completeFollowUp(
                                          followUp._id
                                        )
                                      }
                                      disabled={
                                        completingId ===
                                        followUp._id
                                      }
                                    >
                                      {completingId ===
                                      followUp._id
                                        ? "Saving..."
                                        : "Complete"}
                                    </button>
                                  )}

                                </div>

                              </td>

                            </tr>
                          );
                        }
                      )
                    )}

                  </tbody>

                </table>

              </div>

            </div>

          </section>
        )}

      </main>

      {/* =================================================
          CUSTOMER EDIT MODAL
      ================================================= */}

      {editingCustomer && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setEditingCustomer(null);
            }
          }}
        >
          <div className="modal-card">
            <div className="card-header">
              <h3>Edit Customer</h3>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditingCustomer(null)}
              >
                Close
              </button>
            </div>

            <form onSubmit={saveCustomerEdit}>
              <div className="form-group">
                <label>Customer Name</label>
                <input
                  value={editingCustomer.name || ''}
                  disabled
                />
              </div>

              <div className="form-group">
                <label>Original Quotation Amount</label>
                <input
                  type="number"
                  value={editingCustomer.originalQuotationAmount || 0}
                  disabled
                />
              </div>

              <div className="form-group">
                <label>Revised Quotation Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editingCustomer.quotationAmount ?? 0}
                  onChange={(e) =>
                    setEditingCustomer((prev) => ({
                      ...prev,
                      quotationAmount: e.target.value
                    }))
                  }
                />
              </div>

              <div className="form-group">
                <label>Revision Remark</label>
                <textarea
                  value={editingCustomer.quotationRevisionRemark || ''}
                  onChange={(e) =>
                    setEditingCustomer((prev) => ({
                      ...prev,
                      quotationRevisionRemark: e.target.value
                    }))
                  }
                  placeholder="Enter reason for quotation revision"
                />
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingCustomerEdit}
                >
                  {savingCustomerEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================
          FOLLOW-UP EDIT MODAL
      ================================================= */}

      {editingFollowUp && (
        <div
          className="modal-overlay"
          onClick={(e) => {

            if (
              e.target ===
              e.currentTarget
            ) {
              if (
                !savingFollowUpEdit
              ) {
                setEditingFollowUp(
                  null
                );
              }
            }

          }}
        >

          <div className="modal">

            <div className="modal-header">

              <div>

                <h3>
                  Edit Follow-up
                </h3>

                <p className="modal-subtitle">
                  Update follow-up
                  details
                </p>

              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() =>
                  !savingFollowUpEdit &&
                  setEditingFollowUp(
                    null
                  )
                }
                disabled={
                  savingFollowUpEdit
                }
              >
                ×
              </button>

            </div>

            <div className="modal-body">

              <div className="form-grid">

                <div className="form-group">

                  <label>
                    Customer
                  </label>

                  <input
                    type="text"
                    value={
                      editingFollowUp
                        .customer
                        ?.name || ""
                    }
                    disabled
                  />

                  {editingFollowUp
                    .customer
                    ?.customerCode && (
                    <small className="muted">
                      {
                        editingFollowUp
                          .customer
                          .customerCode
                      }
                    </small>
                  )}

                </div>

                <div className="form-group">

                  <label>
                    Salesperson
                  </label>

                  <select
                    name="salesperson"
                    value={
                      editingFollowUp.salesperson ||
                      ""
                    }
                    onChange={
                      handleEditFollowUpChange
                    }
                  >

                    <option value="">
                      Select Salesperson
                    </option>

                    {salespersons
                      .filter(
                        (sp) =>
                          sp.status ===
                          "Active"
                      )
                      .map(
                        (sp) => (
                          <option
                            key={
                              sp._id
                            }
                            value={
                              sp.name
                            }
                          >
                            {
                              sp.name
                            }
                          </option>
                        )
                      )}

                  </select>

                </div>

                <div className="form-group">

                  <label>
                    Follow-up Date & Time
                  </label>

                  <input
                    type="datetime-local"
                    name="dueAt"
                    value={
                      editingFollowUp.dueAt ||
                      ""
                    }
                    onChange={
                      handleEditFollowUpChange
                    }
                  />

                  <small className="muted">
                    Time is in Dubai
                    local time
                  </small>

                </div>

                <div className="form-group">

                  <label>
                    Type
                  </label>

                  <select
                    name="type"
                    value={
                      editingFollowUp.type ||
                      "Call"
                    }
                    onChange={
                      handleEditFollowUpChange
                    }
                  >

                    <option value="Call">
                      Call
                    </option>

                    <option value="WhatsApp">
                      WhatsApp
                    </option>

                    <option value="Email">
                      Email
                    </option>

                    <option value="Visit">
                      Visit
                    </option>

                    <option value="Meeting">
                      Meeting
                    </option>

                  </select>

                </div>

                <div className="form-group">

                  <label>
                    Status
                  </label>

                  <select
                    name="status"
                    value={
                      editingFollowUp.status ||
                      "Pending"
                    }
                    onChange={
                      handleEditFollowUpChange
                    }
                  >

                    <option value="Pending">
                      Pending
                    </option>

                    <option value="Completed">
                      Completed
                    </option>

                  </select>

                </div>

                <div className="form-group">

                  <label>
                    Priority
                  </label>

                  <select
                    name="priority"
                    value={
                      editingFollowUp.priority ||
                      "Medium"
                    }
                    onChange={
                      handleEditFollowUpChange
                    }
                  >

                    <option value="Low">
                      Low
                    </option>

                    <option value="Medium">
                      Medium
                    </option>

                    <option value="High">
                      High
                    </option>

                    <option value="Urgent">
                      Urgent
                    </option>

                  </select>

                </div>

                <div className="form-group full-width">

                  <label>
                    Summary
                  </label>

                  <textarea
                    name="summary"
                    value={
                      editingFollowUp.summary ||
                      ""
                    }
                    onChange={
                      handleEditFollowUpChange
                    }
                    rows="4"
                    placeholder="Enter follow-up summary..."
                  />

                </div>

                <div className="form-group full-width">

                  <label>
                    Next Action
                  </label>

                  <textarea
                    name="nextAction"
                    value={
                      editingFollowUp.nextAction ||
                      ""
                    }
                    onChange={
                      handleEditFollowUpChange
                    }
                    rows="4"
                    placeholder="Enter next action..."
                  />

                </div>

              </div>

            </div>

            <div className="modal-footer">

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  setEditingFollowUp(
                    null
                  )
                }
                disabled={
                  savingFollowUpEdit
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={
                  saveFollowUpEdit
                }
                disabled={
                  savingFollowUpEdit ||
                  !editingFollowUp.dueAt
                }
              >
                {savingFollowUpEdit
                  ? "Saving..."
                  : "Save Changes"}
              </button>

            </div>

          </div>

        </div>
      )}

      {notificationMessage && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            zIndex: 9999,
            background: "#111",
            color: "#fff",
            padding: "12px 16px",
            borderRadius: "8px",
            boxShadow: "0 6px 20px rgba(0,0,0,0.2)",
            maxWidth: "360px"
          }}
        >
          {notificationMessage}
        </div>
      )}

      {reminderFollowUps.length > 0 && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 9998,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "10px",
              width: "100%",
              maxWidth: "560px",
              padding: "24px",
              boxShadow: "0 12px 40px rgba(0,0,0,0.25)"
            }}
          >
            <h2 style={{ marginTop: 0 }}>
              🔔 Follow-up Reminder
            </h2>

            {reminderFollowUps.map((followUp) => (
              <div
                key={followUp._id}
                style={{
                  padding: "12px",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  marginBottom: "10px"
                }}
              >
                <strong>
                  {followUp.customer?.name || "Customer"}
                </strong>

                <div style={{ marginTop: "5px" }}>
                  {fmt(followUp.dueAt)}
                </div>

                <div style={{ marginTop: "5px" }}>
                  {followUp.type || "Call"}
                  {followUp.salesperson
                    ? ` • ${followUp.salesperson}`
                    : ""}
                </div>
              </div>
            ))}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px"
              }}
            >
              <button
                className="btn btn-secondary"
                onClick={() =>
                  setReminderFollowUps([])
                }
              >
                Dismiss
              </button>

              <button
                className="btn btn-primary"
                onClick={() => {
                  const first =
                    reminderFollowUps[0];

                  setActiveTab("followups");
                  setHighlightedFollowUpId(
                    first?._id || ""
                  );
                  setReminderFollowUps([]);
                }}
              >
                View Follow-up
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/* =========================================================
   REACT ROOT
========================================================= */

createRoot(
  document.getElementById("root")
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
