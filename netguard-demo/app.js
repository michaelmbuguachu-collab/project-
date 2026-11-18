/* NETGUARD static demo: sample data + fake login, saved in the browser only. */
const KEY = "netguard_demo_v1", SESS = "netguard_demo_session";
const $ = s => document.querySelector(s);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const now = () => new Date().toISOString().slice(0, 19).replace("T", " ");
const desc = k => (a, b) => String(b[k]).localeCompare(String(a[k])) || b.id - a.id;
const nid = arr => arr.reduce((m, x) => Math.max(m, x.id), 0) + 1;
const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

const NAV = {
  admin: [["dashboard", "Dashboard"], ["connection", "Customer Connection"], ["customers", "Customer Management"], ["faults", "Fault Logs"], ["notifications", "Notifications"], ["report", "Reports"]],
  technician: [["technician", "My Assignments"]],
  customer: [["customer", "My Notifications"]]
};
const HOME = { admin: "dashboard.html", technician: "technician.html", customer: "customer.html" };

function seed() {
  return {
    users: [
      { id: 1, full_name: "NETGUARD Administrator", username: "admin", password: "demo", role: "admin" },
      { id: 2, full_name: "Field Technician", username: "technician", password: "demo", role: "technician" },
      { id: 3, full_name: "Demo Customer", username: "customer", password: "demo", role: "customer" },
      { id: 4, full_name: "Amina Otieno", username: "amina", password: "demo12345", role: "customer" },
      { id: 5, full_name: "Brian Mwangi", username: "brian", password: "demo12345", role: "customer" }
    ],
    devices: [
      { id: 1, device_name: "Customer Router 1", ip_address: "192.168.1.10", device_type: "Router", status: "Online", customer_id: 3 },
      { id: 2, device_name: "Office Modem", ip_address: "192.168.1.11", device_type: "Modem", status: "Offline", customer_id: 4 },
      { id: 3, device_name: "Access Point A", ip_address: "192.168.1.12", device_type: "Access Point", status: "Online", customer_id: 5 }
    ],
    faults: [
      { id: 1, device_id: 1, fault_type: "Internet Connection Failure", description: "NETGUARD detected an internet connection failure on Customer Router 1", status: "recovered", detected_at: "2026-11-16 09:12:04" },
      { id: 2, device_id: 2, fault_type: "Internet Connection Failure", description: "NETGUARD detected an internet connection failure on Office Modem", status: "active", detected_at: "2026-11-17 14:40:31" }
    ],
    assignments: [
      { id: 1, fault_id: 1, technician_id: 2, customer_id: 3, status: "Completed", assigned_at: "2026-11-16 09:13:00" }
    ],
    notifications: [
      { id: 1, fault_id: 1, message: "NETGUARD detected: Internet Connection Failure", status: "Read", recipient_role: "admin", recipient_id: null, created_at: "2026-11-16 09:12:05" },
      { id: 2, fault_id: 1, message: "NETGUARD detected that the device connection has been restored.", status: "Read", recipient_role: "admin", recipient_id: null, created_at: "2026-11-16 11:30:10" },
      { id: 3, fault_id: 2, message: "NETGUARD detected: Internet Connection Failure", status: "Unread", recipient_role: "admin", recipient_id: null, created_at: "2026-11-17 14:40:32" },
      { id: 4, fault_id: 1, message: "A field technician, Field Technician, has been assigned to investigate your internet connection failure: Internet Connection Failure affecting Customer Router 1. You will receive updates as the repair progresses.", status: "Unread", recipient_role: "customer", recipient_id: 3, created_at: "2026-11-16 09:13:01" }
    ]
  };
}

let D, S, PAGE;
function load() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.users) return d; } catch (e) {}
  const d = seed(); save(d); return d;
}
function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }
function getSession() { try { return JSON.parse(sessionStorage.getItem(SESS)); } catch (e) { return null; } }
function setSession(v) { try { v ? sessionStorage.setItem(SESS, JSON.stringify(v)) : sessionStorage.removeItem(SESS); } catch (e) {} }

const userName = id => (D.users.find(u => u.id === id) || {}).full_name;
const device = id => D.devices.find(d => d.id === id);
const devName = id => (device(id) || {}).device_name || "Unlinked device";
const isOn = s => String(s).toLowerCase() === "online";
function notify(fault_id, message, role, rid) {
  D.notifications.push({ id: nid(D.notifications), fault_id, message, status: "Unread", recipient_role: role, recipient_id: rid ?? null, created_at: now() });
}
const table = (heads, rows, empty) =>
  `<div class="table-wrap"><table><thead><tr>${heads.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>` +
  (rows.length ? rows.join("") : `<tr><td colspan="${heads.length}" class="empty">${empty}</td></tr>`) + `</tbody></table></div>`;
const options = (label, items, text) =>
  `<option value="">${label}</option>` + items.map(i => `<option value="${i.id}">${esc(text(i))}</option>`).join("");

const PAGES = {
  dashboard() {
    const on = D.devices.filter(d => isOn(d.status)).length;
    const off = D.devices.filter(d => d.status.toLowerCase() === "offline").length;
    const recent = [...D.faults].sort(desc("detected_at")).slice(0, 5);
    const active = D.faults.filter(f => f.status === "active");
    const techs = D.users.filter(u => u.role === "technician");
    const custs = D.users.filter(u => u.role === "customer");
    let assign;
    if (!active.length) assign = `<p class="empty">There are currently no active faults to assign.</p>`;
    else if (!techs.length) assign = `<p class="empty">No technician accounts are available.</p>`;
    else if (!custs.length) assign = `<p class="empty">No customer accounts are available.</p>`;
    else assign = `<form id="assignForm">
      <label>Select Active Fault</label><select name="fault_id" required>${options("Choose fault", active, f => `Fault #${f.id} - ${f.fault_type} - ${devName(f.device_id)}`)}</select>
      <label>Select Field Technician</label><select name="technician_id" required>${options("Choose technician", techs, t => t.full_name)}</select>
      <label>Select Affected Customer</label><select name="customer_id" required>${options("Choose customer", custs, c => c.full_name)}</select>
      <button type="submit">Assign Technician</button></form>`;
    return `<header><h1>Dashboard</h1><p>Monitor and manage internet connections in real time.</p></header>
      <section class="cards">
        <div class="card"><p>Total Connections</p><h2>${D.devices.length}</h2></div>
        <div class="card"><p>Online Connections</p><h2>${on}</h2></div>
        <div class="card"><p>Offline Connections</p><h2>${off}</h2></div>
        <div class="card"><p>Failures Detected</p><h2>${D.faults.length}</h2></div></section>
      <section class="panel"><h2>Recent Failures</h2>${table(["Fault Type", "Status", "Date Detected"],
        recent.map(f => `<tr><td>${esc(f.fault_type)}</td><td>${esc(f.status)}</td><td>${esc(f.detected_at)}</td></tr>`), "No failures recorded.")}</section>
      <section class="panel"><h2>Assign Field Technician</h2><p class="sub">Select an active fault, technician and affected customer.</p>${assign}</section>`;
  },
  connection() {
    const rows = [...D.devices].sort(desc("id")).map(d => `<tr><td>${d.id}</td><td>${esc(userName(d.customer_id) || "Not linked")}</td><td>${esc(d.device_name)}</td><td>${esc(d.ip_address)}</td>
      <td><span class="${isOn(d.status) ? "status-online" : "status-offline"}">${esc(isOn(d.status) ? "Online" : d.status)}</span></td></tr>`);
    return `<header><h1>Customer Connection</h1><p>View and monitor registered customer internet connections.</p></header>
      <section class="panel"><h2>Registered Customer Connections</h2>${table(["Connection ID", "Customer Name", "Device Name", "IP Address", "Status"], rows, "No customer connections registered yet.")}</section>`;
  },
  customers() {
    const rows = D.users.filter(u => u.role === "customer").sort(desc("id")).map(u => {
      const d = D.devices.find(x => x.customer_id === u.id) || {};
      return `<tr><td>${u.id}</td><td>${esc(u.full_name)}</td><td>${esc(u.username)}</td><td>${esc(d.device_name || "Not linked")}</td><td>${esc(d.ip_address || "—")}</td><td>${esc(d.device_type || "—")}</td><td>${esc(d.status || "—")}</td></tr>`;
    });
    return `<header><h1>Customer Management</h1><p>Register and manage NETGUARD customers.</p></header>
      <section class="panel"><h2>Register New Customer</h2><form id="custForm"><div class="form-grid">
        <div><label>Customer Full Name</label><input name="full_name" required></div>
        <div><label>Username</label><input name="username" required></div>
        <div><label>Customer Password</label><input type="password" name="password" minlength="8" required></div>
        <div><label>Device Name</label><input name="device_name" placeholder="Customer Router 1" required></div>
        <div><label>Device IP Address</label><input name="ip_address" placeholder="192.168.1.10" required></div>
        <div><label>Device Type</label><select name="device_type" required><option value="">Select device type</option>
          ${["Router", "Modem", "Access Point", "Computer", "Other"].map(t => `<option>${t}</option>`).join("")}</select></div>
      </div><button type="submit">Register Customer</button></form></section>
      <section class="panel"><h2>Registered Customers</h2>${table(["ID", "Full Name", "Username", "Device", "IP Address", "Device Type", "Status"], rows, "No customers registered yet.")}</section>`;
  },
  faults() {
    const rows = [...D.faults].sort(desc("detected_at")).map(f => `<tr><td>${f.id}</td><td>${esc(f.fault_type)}</td><td>${esc(f.description)}</td><td>${esc(f.status)}</td><td>${esc(f.detected_at)}</td></tr>`);
    return `<header><h1>Fault Logs</h1><p>View detected internet connection failures.</p></header>
      <section class="panel"><h2>Detected Failures</h2>${table(["Fault ID", "Fault Type", "Description", "Status", "Date Detected"], rows, "No faults recorded.")}</section>`;
  },
  notifications() {
    const list = [...D.notifications].sort((a, b) => b.id - a.id);
    const unread = list.filter(n => n.status.toLowerCase() === "unread").length;
    const rows = list.map(n => `<tr><td>${n.id}</td><td>${n.fault_id ?? ""}</td><td>${esc(n.message)}</td><td>${esc(n.created_at)}</td>
      <td><span class="pill ${n.status.toLowerCase() === "unread" ? "unread" : "read"}">${esc(n.status)}</span></td>
      <td>${n.status.toLowerCase() === "unread" ? `<button data-read="${n.id}">Mark as Read</button>` : `<span style="color:#55e6a5">Acknowledged</span>`}</td></tr>`);
    return `<header><h1>Fault Notifications</h1><p>Manage and acknowledge detected internet failures.</p></header>
      <section class="cards three"><div class="card"><p>Unread Notifications</p><h2>${unread}</h2></div></section>
      <section class="panel">${table(["ID", "Fault ID", "Message", "Date", "Status", "Action"], rows, "No notifications available.")}</section>`;
  },
  report() {
    const on = D.devices.filter(d => isOn(d.status)).length;
    const off = D.devices.filter(d => d.status.toLowerCase() === "offline").length;
    const rows = [...D.faults].sort(desc("detected_at")).map(f => `<tr><td>${esc(f.fault_type)}</td><td>${esc(f.status)}</td><td>${esc(f.detected_at)}</td></tr>`);
    return `<header><h1>System Reports</h1><p>Overview of network connections, faults and notifications.</p></header>
      <button class="no-print" onclick="window.print()">Print Report</button>
      <section class="cards three">
        <div class="card"><p>Total Connections</p><h2>${D.devices.length}</h2></div>
        <div class="card"><p>Online Connections</p><h2>${on}</h2></div>
        <div class="card"><p>Offline Connections</p><h2>${off}</h2></div>
        <div class="card"><p>Total Faults</p><h2>${D.faults.length}</h2></div>
        <div class="card"><p>Notifications</p><h2>${D.notifications.length}</h2></div></section>
      <section class="panel"><h2>Fault History Report</h2>${table(["Fault Type", "Status", "Date Detected"], rows, "No fault records available.")}</section>`;
  },
  technician() {
    const jobs = D.assignments.filter(a => a.technician_id === S.id).sort(desc("assigned_at"));
    const rows = jobs.map(a => {
      const f = D.faults.find(x => x.id === a.fault_id) || {}, d = device(f.device_id) || {};
      const act = a.status === "Assigned" ? `<button data-accept="${a.id}">Accept Job</button>`
        : a.status === "Accepted" ? `<button data-complete="${a.id}">Complete Job</button>` : "Completed";
      return `<tr><td>${esc(f.fault_type)}</td><td>${esc(d.device_name || "Unknown")}</td><td>${esc(d.ip_address || "N/A")}</td><td>${esc(f.detected_at)}</td><td class="status-online">${esc(a.status)}</td><td>${act}</td></tr>`;
    });
    return `<h1>Field Technician Dashboard</h1><p class="sub">Welcome, ${esc(S.full_name)}</p>
      <section class="cards three">
        <div class="card"><p>Total Assignments</p><h2>${jobs.length}</h2></div>
        <div class="card"><p>Pending Assignments</p><h2>${jobs.filter(j => j.status === "Assigned").length}</h2></div>
        <div class="card"><p>Completed Jobs</p><h2>${jobs.filter(j => j.status === "Completed").length}</h2></div></section>
      <section class="panel"><h2>My Assigned Faults</h2>${table(["Fault", "Device", "IP Address", "Detected", "Status", "Action"], rows, "No assignments received yet.")}</section>`;
  },
  customer() {
    const list = D.notifications.filter(n => n.recipient_role === "customer" && n.recipient_id === S.id).sort(desc("created_at"));
    const unread = list.filter(n => n.status.toLowerCase() === "unread").length;
    const items = list.map(n => {
      const un = n.status.toLowerCase() === "unread";
      return `<div class="notification"><div>${esc(n.message)}</div><div class="date">${esc(n.created_at)}</div>
        <div class="st ${un ? "" : "read"}">${esc(n.status)}</div>${un ? `<button data-read="${n.id}" style="margin-top:10px">Mark as Read</button>` : ""}</div>`;
    }).join("");
    return `<h1>Customer Dashboard</h1><p class="sub">Welcome, ${esc(S.full_name)}</p>
      <section class="cards three"><div class="card"><p>Unread Notifications</p><h2>${unread}</h2></div></section>
      <section class="panel"><h2>Service Updates</h2>${items || `<div class="empty">No service updates yet.</div>`}</section>`;
  }
};

const BIND = {
  dashboard() {
    const f = $("#assignForm"); if (!f) return;
    f.onsubmit = e => {
      e.preventDefault();
      const fid = +f.fault_id.value, tid = +f.technician_id.value, cid = +f.customer_id.value;
      const fault = D.faults.find(x => x.id === fid && x.status === "active");
      const tech = D.users.find(u => u.id === tid && u.role === "technician");
      const cust = D.users.find(u => u.id === cid && u.role === "customer");
      if (!fault || !tech || !cust) return draw(["Please select a valid active fault, technician and customer.", "error"]);
      if (D.assignments.some(a => a.fault_id === fid && ["Assigned", "Accepted"].includes(a.status)))
        return draw(["This fault already has an active technician assignment.", "error"]);
      D.assignments.push({ id: nid(D.assignments), fault_id: fid, technician_id: tid, customer_id: cid, status: "Assigned", assigned_at: now() });
      const dn = devName(fault.device_id);
      notify(fid, `New repair assignment: ${fault.fault_type} affecting ${dn}. Please review and accept the job.`, "technician", tid);
      notify(fid, `A field technician, ${tech.full_name}, has been assigned to investigate your internet connection failure: ${fault.fault_type} affecting ${dn}. You will receive updates as the repair progresses.`, "customer", cid);
      save(D);
      draw(["Technician assigned successfully. Notifications sent to both technician and customer.", "success"]);
    };
  },
  customers() {
    const f = $("#custForm");
    f.onsubmit = e => {
      e.preventDefault();
      const v = Object.fromEntries(new FormData(f).entries());
      Object.keys(v).forEach(k => { if (k !== "password") v[k] = v[k].trim(); });
      if (Object.values(v).some(x => x === "")) return draw(["Please fill in all fields.", "error"]);
      if (!IPV4.test(v.ip_address)) return draw(["Enter a valid IP address.", "error"]);
      if (v.password.length < 8) return draw(["Password must contain at least 8 characters.", "error"]);
      if (D.users.some(u => u.username === v.username) || D.devices.some(d => d.ip_address === v.ip_address))
        return draw(["Username or device details already exist.", "error"]);
      const id = nid(D.users);
      D.users.push({ id, full_name: v.full_name, username: v.username, password: v.password, role: "customer" });
      D.devices.push({ id: nid(D.devices), device_name: v.device_name, ip_address: v.ip_address, device_type: v.device_type, status: "Online", customer_id: id });
      save(D);
      draw(["Customer registered successfully.", "success"]);
    };
  },
  notifications() { markRead(() => true); },
  customer() { markRead(n => n.recipient_role === "customer" && n.recipient_id === S.id); },
  technician() {
    $("#main").onclick = e => {
      const b = e.target.closest("button"); if (!b) return;
      const accept = b.dataset.accept, complete = b.dataset.complete;
      const a = D.assignments.find(x => x.id === +(accept || complete) && x.technician_id === S.id);
      if (!a) return;
      const f = D.faults.find(x => x.id === a.fault_id) || {};
      if (accept && a.status === "Assigned") {
        a.status = "Accepted"; a.accepted_at = now();
        notify(a.fault_id, `NETGUARD UPDATE: A technician, ${S.full_name}, has accepted your internet repair request and is coming to fix your Wi-Fi connection. Reported fault: ${f.fault_type}.`, "customer", a.customer_id);
        save(D); draw(["Job accepted successfully. Customer notification sent.", "success"]);
      } else if (complete && a.status === "Accepted") {
        a.status = "Completed"; a.completed_at = now();
        notify(a.fault_id, "NETGUARD UPDATE: The technician has marked your repair visit as completed. NETGUARD will continue monitoring your internet connection and update you when service recovery is detected.", "customer", a.customer_id);
        save(D); draw(["Job completed successfully. Customer notification sent.", "success"]);
      }
    };
  }
};

function markRead(allowed) {
  $("#main").onclick = e => {
    const b = e.target.closest("button[data-read]"); if (!b) return;
    const n = D.notifications.find(x => x.id === +b.dataset.read);
    if (n && allowed(n)) { n.status = "Read"; save(D); draw(["Notification marked as read successfully.", "success"]); }
  };
}

function draw(msg) {
  const main = $("#main");
  main.onclick = null;
  main.innerHTML = `<div class="demo-note">Demo version: sample data only. Changes are saved in your browser, not in a real database.<a href="#" id="reset">Reset demo data</a></div>` +
    (msg ? `<div class="${msg[1]}">${esc(msg[0])}</div>` : "") + PAGES[PAGE]();
  $("#reset").onclick = e => { e.preventDefault(); try { localStorage.removeItem(KEY); } catch (x) {} location.reload(); };
  if (BIND[PAGE]) BIND[PAGE]();
}

function boot() {
  PAGE = document.body.dataset.page;
  const need = document.body.dataset.role;
  S = getSession();
  if (!S || S.role !== need) { location.replace("index.html"); return; }
  D = load();
  const nav = NAV[S.role].map(([p, t]) => `<a href="${p}.html" class="${p === PAGE ? "active" : ""}">${t}</a>`).join("");
  $("#shell").innerHTML = `<aside class="sidebar"><div class="logo">NET<span>GUARD</span></div><nav>${nav}</nav>
    <div class="logout"><a href="#" id="logout">Logout</a></div></aside><main class="main" id="main"></main>`;
  $("#logout").onclick = e => { e.preventDefault(); setSession(null); location.href = "index.html"; };
  draw();
}

function bootLogin() {
  const s = getSession();
  if (s && HOME[s.role]) { location.replace(HOME[s.role]); return; }
  $("#loginForm").onsubmit = e => {
    e.preventDefault();
    const d = load(), f = e.target;
    const u = d.users.find(x => x.username === f.username.value.trim() && x.password === f.password.value);
    if (!u) { $("#err").textContent = "Invalid username or password."; $("#err").hidden = false; return; }
    setSession({ id: u.id, full_name: u.full_name, role: u.role });
    location.href = HOME[u.role];
  };
}

document.body.dataset.page === "login" ? bootLogin() : boot();
