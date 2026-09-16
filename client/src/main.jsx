import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import './style.css';

const api = axios.create({
  baseURL: 'https://wf-followup-dashboard1.onrender.com/api'
});

/* ========================================================
   UAE / DUBAI TIME HELPERS
   ======================================================== */

// Display stored UTC date/time as UAE/Dubai time
const fmt = (value) => {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString('en-AE', {
    timeZone: 'Asia/Dubai',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

// Convert datetime-local value to UTC ISO.
// datetime-local is treated as Dubai/UAE local time.
//
// Example:
// 2026-09-16T12:20
// becomes:
// 2026-09-16T08:20:00.000Z
const dubaiLocalToISO = (value) => {
  if (!value) return '';

  const [datePart, timePart] = value.split('T');

  if (!datePart || !timePart) return value;

  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);

  const utcDate = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      hour - 4,
      minute,
      0,
      0
    )
  );

  return utcDate.toISOString();
};

// Return current Dubai date as YYYY-MM-DD
const getDubaiToday = () => {
  const now = new Date();

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);

  const get = (type) =>
    parts.find((p) => p.type === type)?.value || '';

  return `${get('year')}-${get('month')}-${get('day')}`;
};

// Convert stored UTC date to Dubai YYYY-MM-DD
const getDubaiDate = (value) => {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);

  const get = (type) =>
    parts.find((p) => p.type === type)?.value || '';

  return `${get('year')}-${get('month')}-${get('day')}`;
};

// Check actual current time for overdue status
const isOverdue = (value) => {
  if (!value) return false;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return false;

  return date.getTime() < Date.now();
};

/* ========================================================
   APP
   ======================================================== */

function App() {
  const [tab, setTab] = useState('Dashboard');

  const [summary, setSummary] = useState({});
  const [customers, setCustomers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [salespersonMaster, setSalespersonMaster] = useState([]);

  const [selectedSalesperson, setSelectedSalesperson] =
    useState('All');

  const [error, setError] = useState('');

  /* ======================================================
     SALESPERSON MASTER FORM
     ====================================================== */

  const [salespersonForm, setSalespersonForm] = useState({
    name: '',
    phone: '',
    whatsapp: '',
    email: '',
    department: 'Sales',
    location: '',
    status: 'Active'
  });

  const [editingSalesperson, setEditingSalesperson] =
    useState(null);

  /* ======================================================
     CUSTOMER FORM
     ====================================================== */

  const [form, setForm] = useState({
    name: '',
    phone: '',
    whatsapp: '',
    email: '',
    location: '',
    productInterest: '',
    quotationAmount: '',
    assignedSalesperson: '',
    status: 'New'
  });

  /* ======================================================
     FOLLOW-UP FORM
     ====================================================== */

  const [task, setTask] = useState({
    customer: '',
    salesperson: '',
    dueAt: '',
    type: 'Call',
    priority: 'Medium',
    summary: '',
    nextAction: ''
  });

  /* ======================================================
     LOAD DATA
     ====================================================== */

  const load = async () => {
    try {
      setError('');

      const [
        summaryResponse,
        customersResponse,
        followupsResponse,
        salespersonsResponse
      ] = await Promise.all([
        api.get('/summary'),
        api.get('/customers'),
        api.get('/followups'),
        api.get('/salespersons')
      ]);

      setSummary(summaryResponse.data || {});
      setCustomers(customersResponse.data || []);
      setTasks(followupsResponse.data || []);
      setSalespersonMaster(
        salespersonsResponse.data || []
      );
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
          'Unable to connect to the CRM server.'
      );
    }
  };

  useEffect(() => {
    load();
  }, []);

  /* ======================================================
     ACTIVE SALESPERSONS
     ====================================================== */

  const activeSalespersons =
    salespersonMaster.filter(
      (sp) => sp.status === 'Active'
    );

  /* ======================================================
     FILTERED CUSTOMERS
     ====================================================== */

  const filteredCustomers =
    selectedSalesperson === 'All'
      ? customers
      : customers.filter(
          (c) =>
            c.assignedSalesperson ===
            selectedSalesperson
        );

  /* ======================================================
     FILTERED FOLLOW-UPS
     ====================================================== */

  const filteredTasks =
    selectedSalesperson === 'All'
      ? tasks
      : tasks.filter(
          (t) =>
            t.salesperson === selectedSalesperson ||
            t.customer?.assignedSalesperson ===
              selectedSalesperson
        );

  /* ======================================================
     DASHBOARD SUMMARY
     ====================================================== */

  const filteredPendingTasks =
    filteredTasks.filter(
      (t) => t.status === 'Pending'
    );

  const todayDubai = getDubaiToday();

  const filteredSummary = {
    customers: filteredCustomers.length,

    pending: filteredPendingTasks.length,

    today: filteredPendingTasks.filter(
      (t) =>
        getDubaiDate(t.dueAt) ===
        todayDubai
    ).length,

    overdue: filteredPendingTasks.filter(
      (t) => isOverdue(t.dueAt)
    ).length,

    completed: filteredTasks.filter(
      (t) => t.status === 'Completed'
    ).length,

    converted: filteredCustomers.filter(
      (c) => c.status === 'Converted'
    ).length,

    quotationAmount:
      filteredCustomers.reduce(
        (total, c) =>
          total +
          Number(c.quotationAmount || 0),
        0
      )
  };

  /* ======================================================
     CUSTOMER
     ====================================================== */

  const addCustomer = async (e) => {
    e.preventDefault();

    try {
      await api.post('/customers', {
        ...form,
        quotationAmount:
          Number(form.quotationAmount || 0)
      });

      setForm({
        name: '',
        phone: '',
        whatsapp: '',
        email: '',
        location: '',
        productInterest: '',
        quotationAmount: '',
        assignedSalesperson: '',
        status: 'New'
      });

      await load();
    } catch (err) {
      console.error(err);

      alert(
        err.response?.data?.message ||
          'Unable to save customer.'
      );
    }
  };

  /* ======================================================
     FOLLOW-UP
     ====================================================== */

  const addTask = async (e) => {
    e.preventDefault();

    try {
      const dataToSave = {
        ...task,
        dueAt: dubaiLocalToISO(task.dueAt)
      };

      await api.post(
        '/followups',
        dataToSave
      );

      setTask({
        customer: '',
        salesperson: '',
        dueAt: '',
        type: 'Call',
        priority: 'Medium',
        summary: '',
        nextAction: ''
      });

      await load();
    } catch (err) {
      console.error(err);

      alert(
        err.response?.data?.message ||
          'Unable to schedule follow-up.'
      );
    }
  };

  /* ======================================================
     SALESPERSON MASTER
     ====================================================== */

  const saveSalesperson = async (e) => {
    e.preventDefault();

    try {
      if (editingSalesperson) {
        await api.patch(
          `/salespersons/${editingSalesperson._id}`,
          salespersonForm
        );
      } else {
        await api.post(
          '/salespersons',
          salespersonForm
        );
      }

      setSalespersonForm({
        name: '',
        phone: '',
        whatsapp: '',
        email: '',
        department: 'Sales',
        location: '',
        status: 'Active'
      });

      setEditingSalesperson(null);

      await load();
    } catch (err) {
      console.error(err);

      alert(
        err.response?.data?.message ||
          'Unable to save salesperson.'
      );
    }
  };

  const editSalesperson = (sp) => {
    setEditingSalesperson(sp);

    setSalespersonForm({
      name: sp.name || '',
      phone: sp.phone || '',
      whatsapp: sp.whatsapp || '',
      email: sp.email || '',
      department:
        sp.department || 'Sales',
      location: sp.location || '',
      status: sp.status || 'Active'
    });

    setTab('Salesperson Master');
  };

  const cancelSalespersonEdit = () => {
    setEditingSalesperson(null);

    setSalespersonForm({
      name: '',
      phone: '',
      whatsapp: '',
      email: '',
      department: 'Sales',
      location: '',
      status: 'Active'
    });
  };

  /* ======================================================
     RENDER
     ====================================================== */

  return (
    <div className="app">

      {/* ==================================================
          SIDEBAR
          ================================================== */}

      <aside>
        <h2>Western Furniture</h2>

        <p className="muted">
          Customer CRM
        </p>

        {[
          'Dashboard',
          'Salesperson Master',
          'Customers',
          'Follow-ups'
        ].map((item) => (
          <button
            key={item}
            className={
              tab === item
                ? 'nav active'
                : 'nav'
            }
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </aside>

      {/* ==================================================
          MAIN CONTENT
          ================================================== */}

      <main>

        <header>
          <div>
            <h1>{tab}</h1>
            <p className="muted">
              Western Furniture Customer CRM
            </p>
          </div>
        </header>

        {error && (
          <div className="error">
            {error}
          </div>
        )}

        {/* ==================================================
            DASHBOARD
            ================================================== */}

        {tab === 'Dashboard' && (
          <>
            <section className="panel">

              <h2>
                Salesperson Filter
              </h2>

              <select
                value={selectedSalesperson}
                onChange={(e) =>
                  setSelectedSalesperson(
                    e.target.value
                  )
                }
              >
                <option value="All">
                  All Salespersons
                </option>

                {activeSalespersons.map(
                  (sp) => (
                    <option
                      key={sp._id}
                      value={sp.name}
                    >
                      {sp.salespersonCode} —{' '}
                      {sp.name}
                    </option>
                  )
                )}
              </select>

            </section>

            {/* KPI CARDS */}

            <section className="cards">

              {[
                [
                  'Customers',
                  filteredSummary.customers
                ],
                [
                  'Pending Follow-ups',
                  filteredSummary.pending
                ],
                [
                  'Due Today',
                  filteredSummary.today
                ],
                [
                  'Overdue',
                  filteredSummary.overdue
                ],
                [
                  'Completed',
                  filteredSummary.completed
                ],
                [
                  'Converted',
                  filteredSummary.converted
                ],
                [
                  'Quotation Value',
                  `AED ${Number(
                    filteredSummary.quotationAmount ||
                      0
                  ).toLocaleString()}`
                ]
              ].map(
                ([label, value]) => (
                  <div
                    className="card"
                    key={label}
                  >
                    <span>{label}</span>

                    <strong>
                      {value ?? 0}
                    </strong>
                  </div>
                )
              )}

            </section>

            {/* PRIORITY FOLLOW-UPS */}

            <section className="panel">

              <h2>
                Priority follow-ups
                {selectedSalesperson !==
                'All'
                  ? ` - ${selectedSalesperson}`
                  : ''}
              </h2>

              {filteredPendingTasks.length ===
              0 ? (
                <p className="muted">
                  No pending follow-ups.
                </p>
              ) : (
                <TaskTable
                  tasks={filteredPendingTasks}
                  load={load}
                />
              )}

            </section>

            {/* SALESPERSON ACTIVITY */}

            <section className="panel">

              <h2>
                Salesperson Activity
              </h2>

              <SalespersonTable
                customers={filteredCustomers}
                tasks={filteredTasks}
                salespersonMaster={
                  salespersonMaster
                }
              />

            </section>
          </>
        )}

        {/* ==================================================
            SALESPERSON MASTER
            ================================================== */}

        {tab === 'Salesperson Master' && (
          <>
            <section className="panel">

              <h2>
                {editingSalesperson
                  ? 'Edit Salesperson'
                  : 'Add Salesperson'}
              </h2>

              <form
                onSubmit={saveSalesperson}
                className="form"
              >

                <input
                  required
                  placeholder="Name"
                  value={
                    salespersonForm.name
                  }
                  onChange={(e) =>
                    setSalespersonForm({
                      ...salespersonForm,
                      name:
                        e.target.value
                    })
                  }
                />

                <input
                  placeholder="Phone"
                  value={
                    salespersonForm.phone
                  }
                  onChange={(e) =>
                    setSalespersonForm({
                      ...salespersonForm,
                      phone:
                        e.target.value
                    })
                  }
                />

                <input
                  placeholder="WhatsApp"
                  value={
                    salespersonForm.whatsapp
                  }
                  onChange={(e) =>
                    setSalespersonForm({
                      ...salespersonForm,
                      whatsapp:
                        e.target.value
                    })
                  }
                />

                <input
                  type="email"
                  placeholder="Email"
                  value={
                    salespersonForm.email
                  }
                  onChange={(e) =>
                    setSalespersonForm({
                      ...salespersonForm,
                      email:
                        e.target.value
                    })
                  }
                />

                <select
                  value={
                    salespersonForm.department
                  }
                  onChange={(e) =>
                    setSalespersonForm({
                      ...salespersonForm,
                      department:
                        e.target.value
                    })
                  }
                >
                  <option value="Sales">
                    Sales
                  </option>

                  <option value="Sales Admin">
                    Sales Admin
                  </option>

                  <option value="Management">
                    Management
                  </option>
                </select>

                <input
                  placeholder="Location"
                  value={
                    salespersonForm.location
                  }
                  onChange={(e) =>
                    setSalespersonForm({
                      ...salespersonForm,
                      location:
                        e.target.value
                    })
                  }
                />

                <select
                  value={
                    salespersonForm.status
                  }
                  onChange={(e) =>
                    setSalespersonForm({
                      ...salespersonForm,
                      status:
                        e.target.value
                    })
                  }
                >
                  <option value="Active">
                    Active
                  </option>

                  <option value="Inactive">
                    Inactive
                  </option>
                </select>

                <button type="submit">
                  {editingSalesperson
                    ? 'Update Salesperson'
                    : 'Add Salesperson'}
                </button>

                {editingSalesperson && (
                  <button
                    type="button"
                    onClick={
                      cancelSalespersonEdit
                    }
                  >
                    Cancel
                  </button>
                )}

              </form>

            </section>

            <section className="panel">

              <h2>
                Salesperson Master
              </h2>

              <p className="muted">
                Master list of all
                salespersons
              </p>

              <p>
                <strong>
                  {salespersonMaster.length}
                </strong>{' '}
                Salespersons
              </p>

              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>WhatsApp</th>
                    <th>Email</th>
                    <th>Department</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {salespersonMaster.map(
                    (sp) => (
                      <tr key={sp._id}>

                        <td>
                          {sp.salespersonCode}
                        </td>

                        <td>
                          {sp.name}
                        </td>

                        <td>
                          {sp.phone || '—'}
                        </td>

                        <td>
                          {sp.whatsapp || '—'}
                        </td>

                        <td>
                          {sp.email || '—'}
                        </td>

                        <td>
                          {sp.department || '—'}
                        </td>

                        <td>
                          {sp.location || '—'}
                        </td>

                        <td>
                          {sp.status}
                        </td>

                        <td>
                          <button
                            type="button"
                            onClick={() =>
                              editSalesperson(
                                sp
                              )
                            }
                          >
                            Edit
                          </button>
                        </td>

                      </tr>
                    )
                  )}

                  {salespersonMaster.length ===
                    0 && (
                    <tr>
                      <td
                        colSpan="9"
                        style={{
                          textAlign:
                            'center'
                        }}
                      >
                        No salespersons
                        found. Use the Add
                        Salesperson form
                        above to create the
                        first salesperson.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

            </section>
          </>
        )}

        {/* ==================================================
            CUSTOMERS
            ================================================== */}

        {tab === 'Customers' && (
          <>
            <section className="panel">

              <h2>Add customer</h2>

              <form
                onSubmit={addCustomer}
                className="form"
              >

                <input
                  required
                  placeholder="Customer Name"
                  value={form.name}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      name:
                        e.target.value
                    })
                  }
                />

                <input
                  placeholder="Phone"
                  value={form.phone}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      phone:
                        e.target.value
                    })
                  }
                />

                <input
                  placeholder="WhatsApp"
                  value={form.whatsapp}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      whatsapp:
                        e.target.value
                    })
                  }
                />

                <input
                  type="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      email:
                        e.target.value
                    })
                  }
                />

                <input
                  placeholder="Location"
                  value={form.location}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      location:
                        e.target.value
                    })
                  }
                />

                <input
                  placeholder="Product Interest"
                  value={
                    form.productInterest
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      productInterest:
                        e.target.value
                    })
                  }
                />

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Quotation Amount"
                  value={
                    form.quotationAmount
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      quotationAmount:
                        e.target.value
                    })
                  }
                />

                <select
                  value={
                    form.assignedSalesperson
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      assignedSalesperson:
                        e.target.value
                    })
                  }
                >
                  <option value="">
                    Select Salesperson
                  </option>

                  {activeSalespersons.map(
                    (sp) => (
                      <option
                        key={sp._id}
                        value={sp.name}
                      >
                        {sp.salespersonCode} —{' '}
                        {sp.name}
                      </option>
                    )
                  )}
                </select>

                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status:
                        e.target.value
                    })
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
                </select>

                <button type="submit">
                  Add Customer
                </button>

              </form>

            </section>

            <section className="panel">

              <h2>Customer master</h2>

              <table>

                <thead>
                  <tr>
                    <th>Customer Code</th>
                    <th>Name</th>
                    <th>Contact</th>
                    <th>Product</th>
                    <th>Salesperson</th>
                    <th>Quotation Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>

                  {filteredCustomers.map(
                    (c) => (
                      <tr key={c._id}>

                        <td>
                          {c.customerCode}
                        </td>

                        <td>
                          {c.name}
                        </td>

                        <td>
                          {c.phone || '—'}
                        </td>

                        <td>
                          {c.productInterest ||
                            '—'}
                        </td>

                        <td>
                          {c.assignedSalesperson ||
                            '—'}
                        </td>

                        <td>
                          AED{' '}
                          {Number(
                            c.quotationAmount ||
                              0
                          ).toLocaleString()}
                        </td>

                        <td>
                          {c.status}
                        </td>

                      </tr>
                    )
                  )}

                  {filteredCustomers.length ===
                    0 && (
                    <tr>
                      <td
                        colSpan="7"
                        style={{
                          textAlign:
                            'center'
                        }}
                      >
                        No customers found.
                      </td>
                    </tr>
                  )}

                </tbody>

              </table>

            </section>
          </>
        )}

        {/* ==================================================
            FOLLOW-UPS
            ================================================== */}

        {tab === 'Follow-ups' && (
          <>
            <section className="panel">

              <h2>
                Schedule follow-up
              </h2>

              <form
                onSubmit={addTask}
                className="form"
              >

                {/* CUSTOMER */}

                <select
                  required
                  value={task.customer}
                  onChange={(e) => {

                    const customer =
                      customers.find(
                        (c) =>
                          c._id ===
                          e.target.value
                      );

                    setTask({
                      ...task,
                      customer:
                        e.target.value,
                      salesperson:
                        customer?.assignedSalesperson ||
                        ''
                    });
                  }}
                >
                  <option value="">
                    Select customer
                  </option>

                  {customers.map(
                    (c) => (
                      <option
                        key={c._id}
                        value={c._id}
                      >
                        {c.name} —{' '}
                        {c.customerCode}
                      </option>
                    )
                  )}

                </select>

                {/* SALESPERSON */}

                <select
                  value={task.salesperson}
                  onChange={(e) =>
                    setTask({
                      ...task,
                      salesperson:
                        e.target.value
                    })
                  }
                >
                  <option value="">
                    Select salesperson
                  </option>

                  {activeSalespersons.map(
                    (sp) => (
                      <option
                        key={sp._id}
                        value={sp.name}
                      >
                        {sp.salespersonCode} —{' '}
                        {sp.name}
                      </option>
                    )
                  )}

                </select>

                {/* DUE DATE/TIME */}

                <label>
                  Follow-up Date & Time
                </label>

                <input
                  required
                  type="datetime-local"
                  value={task.dueAt}
                  onChange={(e) =>
                    setTask({
                      ...task,
                      dueAt:
                        e.target.value
                    })
                  }
                />

                <select
                  value={task.type}
                  onChange={(e) =>
                    setTask({
                      ...task,
                      type:
                        e.target.value
                    })
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

                <select
                  value={task.priority}
                  onChange={(e) =>
                    setTask({
                      ...task,
                      priority:
                        e.target.value
                    })
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

                <input
                  placeholder="Summary"
                  value={task.summary}
                  onChange={(e) =>
                    setTask({
                      ...task,
                      summary:
                        e.target.value
                    })
                  }
                />

                <input
                  placeholder="Next action"
                  value={task.nextAction}
                  onChange={(e) =>
                    setTask({
                      ...task,
                      nextAction:
                        e.target.value
                    })
                  }
                />

                <button type="submit">
                  Schedule Follow-up
                </button>

              </form>

            </section>

            <section className="panel">

              <h2>
                Follow-up history and tasks
              </h2>

              <TaskTable
                tasks={filteredTasks}
                load={load}
              />

            </section>
          </>
        )}

      </main>
    </div>
  );
}

/* ========================================================
   TASK TABLE
   ======================================================== */

function TaskTable({
  tasks,
  load
}) {
  const completeTask = async (id) => {
    try {
      await api.patch(
        `/followups/${id}`,
        {
          status: 'Completed'
        }
      );

      await load();
    } catch (err) {
      console.error(err);

      alert(
        err.response?.data?.message ||
          'Unable to complete follow-up.'
      );
    }
  };

  return (
    <table>

      <thead>
        <tr>
          <th>Customer</th>
          <th>Due Date / Time</th>
          <th>Type</th>
          <th>Priority</th>
          <th>Salesperson</th>
          <th>Summary</th>
          <th>Next Action</th>
          <th>Status</th>
          <th>Action</th>
        </tr>
      </thead>

      <tbody>

        {tasks.map((t) => (
          <tr key={t._id}>

            <td>
              {t.customer?.name || '—'}
            </td>

            <td>
              {fmt(t.dueAt)}
            </td>

            <td>
              {t.type || '—'}
            </td>

            <td>
              {t.priority || '—'}
            </td>

            <td>
              {t.salesperson ||
                t.customer
                  ?.assignedSalesperson ||
                '—'}
            </td>

            <td>
              {t.summary || '—'}
            </td>

            <td>
              {t.nextAction || '—'}
            </td>

            <td>
              <span
                className={
                  t.status === 'Completed'
                    ? 'status completed'
                    : isOverdue(t.dueAt)
                    ? 'status overdue'
                    : 'status pending'
                }
              >
                {t.status}
              </span>
            </td>

            <td>

              {t.status === 'Pending' && (
                <button
                  type="button"
                  onClick={() =>
                    completeTask(t._id)
                  }
                >
                  Complete
                </button>
              )}

            </td>

          </tr>
        ))}

        {tasks.length === 0 && (
          <tr>
            <td
              colSpan="9"
              style={{
                textAlign: 'center'
              }}
            >
              No follow-ups found.
            </td>
          </tr>
        )}

      </tbody>

    </table>
  );
}

/* ========================================================
   SALESPERSON TABLE
   ======================================================== */

function SalespersonTable({
  customers,
  tasks,
  salespersonMaster
}) {
  const todayDubai =
    getDubaiToday();

  const activityNames = [
    ...customers.map(
      (c) =>
        c.assignedSalesperson
    ),
    ...tasks.map(
      (t) =>
        t.salesperson
    )
  ];

  const names = [
    ...new Set(
      [
        ...salespersonMaster
          .filter(
            (sp) =>
              sp.status === 'Active'
          )
          .map(
            (sp) => sp.name
          ),
        ...activityNames
      ].filter(Boolean)
    )
  ];

  return (
    <table>

      <thead>
        <tr>
          <th>Salesperson</th>
          <th>Customers</th>
          <th>Pending</th>
          <th>Due Today</th>
          <th>Overdue</th>
          <th>Completed</th>
          <th>Converted</th>
        </tr>
      </thead>

      <tbody>

        {names.map((name) => {

          const cs =
            customers.filter(
              (c) =>
                c.assignedSalesperson ===
                name
            );

          const ts =
            tasks.filter(
              (t) =>
                t.salesperson ===
                  name ||
                t.customer
                  ?.assignedSalesperson ===
                  name
            );

          const pending =
            ts.filter(
              (t) =>
                t.status ===
                'Pending'
            );

          const due =
            pending.filter(
              (t) =>
                getDubaiDate(
                  t.dueAt
                ) === todayDubai
            );

          const overdue =
            pending.filter(
              (t) =>
                isOverdue(
                  t.dueAt
                )
            );

          const completed =
            ts.filter(
              (t) =>
                t.status ===
                'Completed'
            ).length;

          const converted =
            cs.filter(
              (c) =>
                c.status ===
                'Converted'
            ).length;

          return (
            <tr key={name}>

              <td>
                <strong>
                  {name}
                </strong>
              </td>

              <td>
                {cs.length}
              </td>

              <td>
                {pending.length}
              </td>

              <td>
                {due.length}
              </td>

              <td>
                <span className="status overdue">
                  {overdue.length}
                </span>
              </td>

              <td>
                {completed}
              </td>

              <td>
                {converted}
              </td>

            </tr>
          );
        })}

        {names.length === 0 && (
          <tr>
            <td
              colSpan="7"
              style={{
                textAlign: 'center'
              }}
            >
              No salesperson activity
              found.
            </td>
          </tr>
        )}

      </tbody>

    </table>
  );
}

/* ========================================================
   START REACT
   ======================================================== */

createRoot(
  document.getElementById('root')
).render(
  <App />
);
