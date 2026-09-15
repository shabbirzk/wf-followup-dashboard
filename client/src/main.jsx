import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import './style.css';

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
});

const fmt = (d) => new Date(d).toLocaleString();

function App() {
  const [tab, setTab] = useState('Dashboard');
  const [summary, setSummary] = useState({});
  const [customers, setCustomers] = useState([]);
  const [tasks, setTasks] = useState([]);

  const [form, setForm] = useState({
    name: '',
    phone: '',
    whatsapp: '',
    email: '',
    location: '',
    assignedSalesperson: '',
    productInterest: '',
    quotationAmount: 0
  });

  const [task, setTask] = useState({
    customer: '',
    salesperson: '',
    dueAt: '',
    type: 'Call',
    priority: 'Medium',
    summary: '',
    nextAction: ''
  });

  const load = async () => {
    const [a, b, c] = await Promise.all([
      api.get('/summary'),
      api.get('/customers'),
      api.get('/followups')
    ]);

    setSummary(a.data);
    setCustomers(b.data);
    setTasks(c.data);
  };

  useEffect(() => {
    load();
  }, []);

  const addCustomer = async (e) => {
    e.preventDefault();

    await api.post('/customers', form);

    setForm({
      name: '',
      phone: '',
      whatsapp: '',
      email: '',
      location: '',
      assignedSalesperson: '',
      productInterest: '',
      quotationAmount: 0
    });

    load();
  };

  const addTask = async (e) => {
    e.preventDefault();

    await api.post('/followups', task);

    setTask({
      ...task,
      customer: '',
      dueAt: '',
      summary: '',
      nextAction: ''
    });

    load();
  };

  return (
    <div className="app">
      <aside>
        <h2>Western Furniture</h2>

        <p className="muted">Customer CRM</p>

        {['Dashboard', 'Customers', 'Follow-ups'].map((x) => (
          <button
            key={x}
            className={tab === x ? 'nav active' : 'nav'}
            onClick={() => setTab(x)}
          >
            {x}
          </button>
        ))}
      </aside>

      <main>
        <header>
          <div>
            <h1>{tab}</h1>

            <p className="muted">
              Customer follow-up reminder dashboard
            </p>
          </div>

          <button onClick={load}>Refresh</button>
        </header>

        {tab === 'Dashboard' && (
          <>
            <section className="cards">
              {[
                ['Customers', summary.customers],
                ['Pending', summary.pending],
                ['Due Today', summary.today],
                ['Overdue', summary.overdue],
                ['Completed', summary.completed],
                ['Converted', summary.converted]
              ].map(([a, b]) => (
                <div className="card" key={a}>
                  <span>{a}</span>
                  <strong>{b ?? 0}</strong>
                </div>
              ))}
            </section>

            <section className="panel">
              <h2>Priority follow-ups</h2>

              <TaskTable
                tasks={tasks
                  .filter((t) => t.status === 'Pending')
                  .slice(0, 8)}
                load={load}
              />
            </section>

            <section className="panel">
              <h2>Salesperson-wise details</h2>

              <p className="muted">
                Assigned customers, pending tasks, overdue tasks and
                completed follow-ups.
              </p>

              <SalespersonTable
                customers={customers}
                tasks={tasks}
              />
            </section>
          </>
        )}

        {tab === 'Customers' && (
          <>
            <section className="panel">
              <h2>Add customer</h2>

              <form onSubmit={addCustomer} className="form">
                {[
                  ['name', 'Customer name'],
                  ['phone', 'Phone'],
                  ['whatsapp', 'WhatsApp'],
                  ['email', 'Email'],
                  ['location', 'Location'],
                  ['assignedSalesperson', 'Salesperson'],
                  ['productInterest', 'Product interest'],
                  ['quotationAmount', 'Quotation amount']
                ].map(([k, p]) => (
                  <input
                    key={k}
                    required={k === 'name'}
                    type={k === 'quotationAmount' ? 'number' : 'text'}
                    placeholder={p}
                    value={form[k]}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        [k]: e.target.value
                      })
                    }
                  />
                ))}

                <button>Add customer</button>
              </form>
            </section>

            <section className="panel">
              <h2>Customer master</h2>

              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Contact</th>
                    <th>Product</th>
                    <th>Salesperson</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {customers.map((c) => (
                    <tr key={c._id}>
                      <td>{c.customerCode}</td>
                      <td>{c.name}</td>
                      <td>{c.phone}</td>
                      <td>{c.productInterest}</td>
                      <td>{c.assignedSalesperson}</td>
                      <td>{c.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}

        {tab === 'Follow-ups' && (
          <>
            <section className="panel">
              <h2>Schedule follow-up</h2>

              <form onSubmit={addTask} className="form">
                <select
                  required
                  value={task.customer}
                  onChange={(e) =>
                    setTask({
                      ...task,
                      customer: e.target.value
                    })
                  }
                >
                  <option value="">Select customer</option>

                  {customers.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} — {c.customerCode}
                    </option>
                  ))}
                </select>

                <input
                  placeholder="Salesperson"
                  value={task.salesperson}
                  onChange={(e) =>
                    setTask({
                      ...task,
                      salesperson: e.target.value
                    })
                  }
                />

                <input
                  required
                  type="datetime-local"
                  value={task.dueAt}
                  onChange={(e) =>
                    setTask({
                      ...task,
                      dueAt: e.target.value
                    })
                  }
                />

                <select
                  value={task.type}
                  onChange={(e) =>
                    setTask({
                      ...task,
                      type: e.target.value
                    })
                  }
                >
                  {[
                    'Call',
                    'WhatsApp',
                    'Email',
                    'Visit',
                    'Quotation'
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>

                <select
                  value={task.priority}
                  onChange={(e) =>
                    setTask({
                      ...task,
                      priority: e.target.value
                    })
                  }
                >
                  {['Low', 'Medium', 'High'].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>

                <input
                  placeholder="Summary"
                  value={task.summary}
                  onChange={(e) =>
                    setTask({
                      ...task,
                      summary: e.target.value
                    })
                  }
                />

                <input
                  placeholder="Next action"
                  value={task.nextAction}
                  onChange={(e) =>
                    setTask({
                      ...task,
                      nextAction: e.target.value
                    })
                  }
                />

                <button>Schedule</button>
              </form>
            </section>

            <section className="panel">
              <h2>Follow-up history and tasks</h2>

              <TaskTable
                tasks={tasks}
                load={load}
              />
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function TaskTable({ tasks, load }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Customer</th>
          <th>Due</th>
          <th>Type</th>
          <th>Salesperson</th>
          <th>Status</th>
          <th>Action</th>
        </tr>
      </thead>

      <tbody>
        {tasks.map((t) => (
          <tr key={t._id}>
            <td>{t.customer?.name || '—'}</td>

            <td>{fmt(t.dueAt)}</td>

            <td>{t.type}</td>

            <td>{t.salesperson}</td>

            <td>
              <span
                className={
                  'status ' + t.status.toLowerCase()
                }
              >
                {t.status}
              </span>
            </td>

            <td>
              {t.status === 'Pending' && (
                <button
                  onClick={async () => {
                    await api.patch(
                      '/followups/' + t._id,
                      {
                        status: 'Completed'
                      }
                    );

                    load();
                  }}
                >
                  Complete
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SalespersonTable({ customers, tasks }) {
  const names = [
    ...new Set([
      ...customers.map(
        (c) => c.assignedSalesperson
      ),
      ...tasks.map(
        (t) => t.salesperson
      )
    ].filter(Boolean))
  ];

  const now = new Date();

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
          <th>Conversion</th>
        </tr>
      </thead>

      <tbody>
        {names.map((name) => {
          const cs = customers.filter(
            (c) =>
              c.assignedSalesperson === name
          );

          const ts = tasks.filter(
            (t) =>
              t.salesperson === name
          );

          const pending = ts.filter(
            (t) =>
              t.status === 'Pending'
          );

          const due = pending.filter(
            (t) =>
              new Date(t.dueAt).toDateString() ===
              now.toDateString()
          );

          const overdue = pending.filter(
            (t) =>
              new Date(t.dueAt) < now
          );

          const completed = ts.filter(
            (t) =>
              t.status === 'Completed'
          ).length;

          const converted = cs.filter(
            (c) =>
              c.status === 'Converted'
          ).length;

          return (
            <tr key={name}>
              <td>
                <strong>{name}</strong>
              </td>

              <td>{cs.length}</td>

              <td>{pending.length}</td>

              <td>{due.length}</td>

              <td>
                <span className="status overdue">
                  {overdue.length}
                </span>
              </td>

              <td>{completed}</td>

              <td>
                {cs.length
                  ? Math.round(
                      (converted / cs.length) * 100
                    )
                  : 0}
                %
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

createRoot(
  document.getElementById('root')
).render(<App />);