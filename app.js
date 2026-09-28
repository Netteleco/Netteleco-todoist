const STORAGE_KEY = "todo-app-state-v1";
const COLORS = ["#6366f1", "#ef4444", "#f59e0b", "#10b981", "#0ea5e9", "#a855f7", "#ec4899", "#64748b"];

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {
    projects: [
      { id: "inbox", name: "Bandeja de entrada", color: "#64748b" },
    ],
    tasks: [],
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const state = loadState();
let currentView = { type: "all" };
let sortBy = "deadline";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function getProject(id) {
  return state.projects.find((p) => p.id === id);
}

function taskMatchesView(task) {
  if (currentView.type === "project") return task.projectId === currentView.id;
  if (currentView.type === "today") return task.deadline === todayISO() && !task.done;
  if (currentView.type === "overdue") return task.deadline && task.deadline < todayISO() && !task.done;
  return true;
}

function sortTasks(tasks) {
  const priorityRank = { high: 0, medium: 1, low: 2 };
  return [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (sortBy === "deadline") {
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return a.deadline.localeCompare(b.deadline);
    }
    if (sortBy === "priority") {
      return priorityRank[a.priority] - priorityRank[b.priority];
    }
    return a.createdAt - b.createdAt;
  });
}

function deadlineBadgeClass(deadline, done) {
  if (!deadline || done) return "";
  const today = todayISO();
  if (deadline < today) return "overdue";
  if (deadline === today) return "today";
  return "";
}

function formatDeadline(deadline) {
  const d = new Date(deadline + "T00:00:00");
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function renderProjects() {
  const list = document.getElementById("projectList");
  list.innerHTML = "";
  state.projects.forEach((project) => {
    const count = state.tasks.filter((t) => t.projectId === project.id && !t.done).length;
    const li = document.createElement("li");
    li.className = "project-item" + (currentView.type === "project" && currentView.id === project.id ? " active" : "");
    li.innerHTML = `
      <span class="label">
        <span class="dot" style="background:${project.color}"></span>
        <span class="name">${escapeHtml(project.name)}</span>
      </span>
      <span style="display:flex;align-items:center;gap:6px;">
        <span class="count">${count}</span>
        <button class="delete-btn" title="Eliminar proyecto">&times;</button>
      </span>
    `;
    li.querySelector(".label").addEventListener("click", () => {
      currentView = { type: "project", id: project.id };
      render();
    });
    li.querySelector(".delete-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      if (project.id === "inbox") return;
      if (!confirm(`Eliminar el proyecto "${project.name}" y sus tareas?`)) return;
      state.projects = state.projects.filter((p) => p.id !== project.id);
      state.tasks = state.tasks.filter((t) => t.projectId !== project.id);
      if (currentView.type === "project" && currentView.id === project.id) currentView = { type: "all" };
      saveState();
      render();
    });
    list.appendChild(li);
  });
}

function renderProjectSelect() {
  const select = document.getElementById("taskProject");
  select.innerHTML = state.projects
    .map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
    .join("");
  if (currentView.type === "project") select.value = currentView.id;
}

function renderViewTitle() {
  const title = document.getElementById("viewTitle");
  if (currentView.type === "all") title.textContent = "Todas las tareas";
  else if (currentView.type === "today") title.textContent = "Hoy";
  else if (currentView.type === "overdue") title.textContent = "Vencidas";
  else if (currentView.type === "project") title.textContent = getProject(currentView.id)?.name ?? "Proyecto";

  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.classList.toggle("active", currentView.type === btn.dataset.view);
  });
}

function renderTasks() {
  const list = document.getElementById("taskList");
  const empty = document.getElementById("emptyState");
  const visible = sortTasks(state.tasks.filter(taskMatchesView));

  list.innerHTML = "";
  empty.hidden = visible.length > 0;

  visible.forEach((task) => {
    const project = getProject(task.projectId);
    const div = document.createElement("div");
    div.className = "task-item" + (task.done ? " done" : "");

    const deadlineClass = deadlineBadgeClass(task.deadline, task.done);
    const deadlineBadge = task.deadline
      ? `<span class="badge deadline ${deadlineClass}">${deadlineClass === "overdue" ? "Vencida" : deadlineClass === "today" ? "Hoy" : formatDeadline(task.deadline)}</span>`
      : "";

    div.innerHTML = `
      <input type="checkbox" ${task.done ? "checked" : ""} />
      <div class="task-main">
        <div class="task-title">${escapeHtml(task.title)}</div>
        <div class="task-meta">
          ${project ? `<span class="badge project" style="background:${project.color}">${escapeHtml(project.name)}</span>` : ""}
          ${deadlineBadge}
          <span class="badge priority-${task.priority}">${task.priority === "high" ? "Alta" : task.priority === "medium" ? "Media" : "Baja"}</span>
        </div>
      </div>
      <button class="task-delete" title="Eliminar">&times;</button>
    `;

    div.querySelector('input[type="checkbox"]').addEventListener("change", (e) => {
      task.done = e.target.checked;
      saveState();
      render();
    });

    div.querySelector(".task-delete").addEventListener("click", () => {
      state.tasks = state.tasks.filter((t) => t.id !== task.id);
      saveState();
      render();
    });

    list.appendChild(div);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function render() {
  renderProjects();
  renderProjectSelect();
  renderViewTitle();
  renderTasks();
}

document.querySelectorAll(".view-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    currentView = { type: btn.dataset.view };
    render();
  });
});

document.getElementById("sortSelect").addEventListener("change", (e) => {
  sortBy = e.target.value;
  render();
});

document.getElementById("taskForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const title = document.getElementById("taskTitle").value.trim();
  if (!title) return;
  const projectId = document.getElementById("taskProject").value;
  const deadline = document.getElementById("taskDeadline").value || null;
  const priority = document.getElementById("taskPriority").value;

  state.tasks.push({
    id: uid(),
    title,
    projectId,
    deadline,
    priority,
    done: false,
    createdAt: Date.now(),
  });

  saveState();
  document.getElementById("taskTitle").value = "";
  document.getElementById("taskDeadline").value = "";
  render();
});

const projectDialog = document.getElementById("projectDialog");
let selectedColor = COLORS[0];

function renderColorPicker() {
  const picker = document.getElementById("colorPicker");
  picker.innerHTML = "";
  COLORS.forEach((color) => {
    const swatch = document.createElement("div");
    swatch.className = "color-swatch" + (color === selectedColor ? " selected" : "");
    swatch.style.background = color;
    swatch.addEventListener("click", () => {
      selectedColor = color;
      renderColorPicker();
    });
    picker.appendChild(swatch);
  });
}

document.getElementById("addProjectBtn").addEventListener("click", () => {
  selectedColor = COLORS[state.projects.length % COLORS.length];
  document.getElementById("projectName").value = "";
  renderColorPicker();
  projectDialog.showModal();
});

document.getElementById("cancelProjectBtn").addEventListener("click", () => {
  projectDialog.close();
});

document.getElementById("projectForm").addEventListener("submit", (e) => {
  const name = document.getElementById("projectName").value.trim();
  if (!name) {
    e.preventDefault();
    return;
  }
  state.projects.push({ id: uid(), name, color: selectedColor });
  saveState();
  render();
});

render();
