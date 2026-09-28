const STORAGE_KEY = "todo-app-state-v1";
const COLORS = ["#6366f1", "#ef4444", "#f59e0b", "#10b981", "#0ea5e9", "#a855f7", "#ec4899", "#64748b"];

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      (parsed.tasks || []).forEach((task) => {
        if (!Array.isArray(task.subtasks)) task.subtasks = [];
        if (!Array.isArray(task.comments)) task.comments = [];
        if (!Array.isArray(task.attachments)) task.attachments = [];
      });
      return parsed;
    }
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
      const removedTasks = state.tasks.filter((t) => t.projectId === project.id);
      state.tasks = state.tasks.filter((t) => t.projectId !== project.id);
      removedTasks.forEach((t) => {
        try {
          if (typeof deleteAttachmentsForTask === "function") deleteAttachmentsForTask(t.id).catch(() => {});
        } catch (err) {}
      });
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

    const assignee = typeof getUserById === "function" ? getUserById(task.assigneeId ?? null) : undefined;
    const assigneeBadge = assignee
      ? `<span class="badge assignee"><span class="user-avatar tiny" style="background:${assignee.color}">${escapeHtml(userInitials(assignee.name))}</span>${escapeHtml(assignee.name)}</span>`
      : "";

    const subtasks = task.subtasks || [];
    const comments = task.comments || [];
    const attachments = task.attachments || [];
    const subtaskBadge = subtasks.length > 0
      ? `<span class="badge subtask-count">${subtasks.filter((s) => s.done).length}/${subtasks.length}</span>`
      : "";
    const commentBadge = comments.length > 0
      ? `<span class="badge comment-count">💬 ${comments.length}</span>`
      : "";
    const attachmentBadge = attachments.length > 0
      ? `<span class="badge attachment-count">📎 ${attachments.length}</span>`
      : "";

    div.innerHTML = `
      <input type="checkbox" ${task.done ? "checked" : ""} />
      <div class="task-main">
        <div class="task-title">${escapeHtml(task.title)}</div>
        <div class="task-meta">
          ${project ? `<span class="badge project" style="background:${project.color}">${escapeHtml(project.name)}</span>` : ""}
          ${deadlineBadge}
          <span class="badge priority-${task.priority}">${task.priority === "high" ? "Alta" : task.priority === "medium" ? "Media" : "Baja"}</span>
          ${assigneeBadge}
          ${subtaskBadge}
          ${commentBadge}
          ${attachmentBadge}
        </div>
      </div>
      <button class="task-delete" title="Eliminar">&times;</button>
    `;

    div.querySelector('input[type="checkbox"]').addEventListener("change", (e) => {
      task.done = e.target.checked;
      saveState();
      render();
    });

    div.querySelector(".task-main").addEventListener("click", () => {
      openTaskDetail(task.id);
    });

    div.querySelector(".task-delete").addEventListener("click", (e) => {
      e.stopPropagation();
      state.tasks = state.tasks.filter((t) => t.id !== task.id);
      saveState();
      try {
        if (typeof deleteAttachmentsForTask === "function") deleteAttachmentsForTask(task.id).catch(() => {});
      } catch (err) {}
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
  if (typeof renderAssigneeSelect === "function") renderAssigneeSelect();
  if (typeof currentDetailTaskId !== "undefined" && currentDetailTaskId && taskDetailDialog.open) {
    renderTaskDetail();
  }
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
  const assigneeId = document.getElementById("taskAssignee").value || null;

  state.tasks.push({
    id: uid(),
    title,
    projectId,
    deadline,
    priority,
    assigneeId,
    done: false,
    createdAt: Date.now(),
    subtasks: [],
    comments: [],
    attachments: [],
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

// ---------------------------------------------------------------------------
// Task detail dialog (subtasks, comments, attachments)
// ---------------------------------------------------------------------------

const taskDetailDialog = document.getElementById("taskDetailDialog");
let currentDetailTaskId = null;
let detailAttachmentObjectUrls = [];

function getTaskById(id) {
  return state.tasks.find((t) => t.id === id);
}

function revokeDetailObjectUrls() {
  detailAttachmentObjectUrls.forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch (e) {}
  });
  detailAttachmentObjectUrls = [];
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function openTaskDetail(taskId) {
  const task = getTaskById(taskId);
  if (!task) return;
  currentDetailTaskId = taskId;
  lastRenderedAttachmentsSignature = null;
  renderTaskDetail();
  taskDetailDialog.showModal();
}

function renderDetailProjectSelect(task) {
  const select = document.getElementById("detailProject");
  select.innerHTML = state.projects
    .map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
    .join("");
  select.value = task.projectId;
}

function renderDetailAssigneeSelect(task) {
  const select = document.getElementById("detailAssignee");
  if (!select) return;
  const users = typeof usersState !== "undefined" ? usersState.users : [];
  select.innerHTML =
    `<option value="">Sin asignar</option>` +
    users.map((u) => `<option value="${escapeHtml(u.id)}">${escapeHtml(u.name)}</option>`).join("");
  select.value = task.assigneeId || "";
}

function renderSubtaskList(task) {
  const list = document.getElementById("subtaskList");
  const progress = document.getElementById("subtaskProgress");
  const subtasks = task.subtasks || [];
  const doneCount = subtasks.filter((s) => s.done).length;
  progress.textContent = subtasks.length > 0 ? `${doneCount}/${subtasks.length} completadas` : "";

  list.innerHTML = "";
  subtasks.forEach((subtask) => {
    const li = document.createElement("li");
    li.className = "subtask-item" + (subtask.done ? " done" : "");
    li.innerHTML = `
      <input type="checkbox" ${subtask.done ? "checked" : ""} />
      <span class="subtask-title">${escapeHtml(subtask.title)}</span>
      <button type="button" class="delete-btn" title="Eliminar subtarea">&times;</button>
    `;
    li.querySelector('input[type="checkbox"]').addEventListener("change", (e) => {
      subtask.done = e.target.checked;
      saveState();
      renderSubtaskList(task);
      render();
    });
    li.querySelector(".delete-btn").addEventListener("click", () => {
      task.subtasks = task.subtasks.filter((s) => s.id !== subtask.id);
      saveState();
      renderSubtaskList(task);
      render();
    });
    list.appendChild(li);
  });
}

function renderCommentList(task) {
  const list = document.getElementById("commentList");
  const comments = task.comments || [];
  list.innerHTML = "";
  comments.forEach((comment) => {
    const author = typeof getUserById === "function" ? getUserById(comment.authorId) : undefined;
    const authorName = author ? author.name : "Usuario eliminado";
    const authorColor = author ? author.color : "var(--text-dim)";
    const authorInitials = author && typeof userInitials === "function" ? userInitials(author.name) : "?";
    const when = new Date(comment.createdAt).toLocaleString("es-ES");
    const li = document.createElement("li");
    li.className = "comment-item";
    li.innerHTML = `
      <span class="user-avatar small" style="background:${authorColor}">${escapeHtml(authorInitials)}</span>
      <div class="comment-body">
        <div class="comment-meta">
          <span class="comment-author">${escapeHtml(authorName)}</span>
          <span class="comment-date">${escapeHtml(when)}</span>
        </div>
        <div class="comment-text">${escapeHtml(comment.text)}</div>
      </div>
    `;
    list.appendChild(li);
  });
}

function renderAttachmentList(task) {
  const list = document.getElementById("attachmentList");
  revokeDetailObjectUrls();
  list.innerHTML = "";
  const attachments = task.attachments || [];

  attachments.forEach((att) => {
    const li = document.createElement("li");
    li.className = "attachment-item";
    li.innerHTML = `
      <div class="attachment-preview"></div>
      <div class="attachment-info">
        <span class="attachment-name">${escapeHtml(att.name)}</span>
        <span class="attachment-size">${escapeHtml(formatFileSize(att.size))}</span>
      </div>
      <div class="attachment-actions">
        <button type="button" class="ghost-btn attachment-download">Descargar</button>
        <button type="button" class="delete-btn" title="Eliminar adjunto">&times;</button>
      </div>
    `;

    const preview = li.querySelector(".attachment-preview");
    if (att.type && att.type.startsWith("image/")) {
      try {
        getAttachment(att.id)
          .then((record) => {
            if (!record) return;
            const url = URL.createObjectURL(record.blob);
            detailAttachmentObjectUrls.push(url);
            const img = document.createElement("img");
            img.src = url;
            img.alt = att.name;
            preview.appendChild(img);
          })
          .catch(() => {});
      } catch (e) {}
    } else {
      preview.textContent = "📄";
    }

    li.querySelector(".attachment-download").addEventListener("click", () => {
      try {
        getAttachment(att.id)
          .then((record) => {
            if (!record) return;
            const url = URL.createObjectURL(record.blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = att.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          })
          .catch(() => {});
      } catch (e) {}
    });

    li.querySelector(".delete-btn").addEventListener("click", () => {
      task.attachments = task.attachments.filter((a) => a.id !== att.id);
      saveState();
      try {
        deleteAttachment(att.id);
      } catch (e) {}
      renderAttachmentList(task);
      render();
    });

    list.appendChild(li);
  });
}

let lastRenderedAttachmentsSignature = null;

function renderTaskDetail() {
  const task = getTaskById(currentDetailTaskId);
  if (!task) return;

  const titleInput = document.getElementById("detailTitle");
  // Don't clobber in-progress typing: render() runs on every save elsewhere
  // in the app (e.g. adding a subtask), which would otherwise reset this
  // field's value out from under the user while they're mid-edit and
  // haven't blurred/changed it yet.
  if (document.activeElement !== titleInput) {
    titleInput.value = task.title;
  }
  renderDetailProjectSelect(task);
  document.getElementById("detailDeadline").value = task.deadline || "";
  document.getElementById("detailPriority").value = task.priority;
  renderDetailAssigneeSelect(task);

  renderSubtaskList(task);
  renderCommentList(task);

  // Attachment thumbnails are fetched async from IndexedDB; skip re-fetching
  // and re-rendering (which also revokes live object URLs, causing visible
  // flicker) when the attachment list itself hasn't actually changed.
  const signature = JSON.stringify((task.attachments || []).map((a) => a.id));
  if (signature !== lastRenderedAttachmentsSignature) {
    lastRenderedAttachmentsSignature = signature;
    renderAttachmentList(task);
  }
}

document.getElementById("detailTitle").addEventListener("change", (e) => {
  const task = getTaskById(currentDetailTaskId);
  if (!task) return;
  const value = e.target.value.trim();
  if (!value) {
    e.target.value = task.title;
    return;
  }
  task.title = value;
  saveState();
  render();
});

document.getElementById("detailProject").addEventListener("change", (e) => {
  const task = getTaskById(currentDetailTaskId);
  if (!task) return;
  task.projectId = e.target.value;
  saveState();
  render();
});

document.getElementById("detailDeadline").addEventListener("change", (e) => {
  const task = getTaskById(currentDetailTaskId);
  if (!task) return;
  task.deadline = e.target.value || null;
  saveState();
  render();
});

document.getElementById("detailPriority").addEventListener("change", (e) => {
  const task = getTaskById(currentDetailTaskId);
  if (!task) return;
  task.priority = e.target.value;
  saveState();
  render();
});

document.getElementById("detailAssignee").addEventListener("change", (e) => {
  const task = getTaskById(currentDetailTaskId);
  if (!task) return;
  task.assigneeId = e.target.value || null;
  saveState();
  render();
});

document.getElementById("addSubtaskBtn").addEventListener("click", () => {
  const task = getTaskById(currentDetailTaskId);
  if (!task) return;
  const input = document.getElementById("subtaskInput");
  const title = input.value.trim();
  if (!title) return;
  task.subtasks.push({ id: uid(), title, done: false });
  saveState();
  input.value = "";
  renderSubtaskList(task);
  render();
});

document.getElementById("addCommentBtn").addEventListener("click", () => {
  const task = getTaskById(currentDetailTaskId);
  if (!task) return;
  const input = document.getElementById("commentInput");
  const text = input.value.trim();
  if (!text) return;
  const authorId = typeof getCurrentUser === "function" ? (getCurrentUser()?.id ?? null) : null;
  task.comments.push({ id: uid(), authorId, text, createdAt: Date.now() });
  saveState();
  input.value = "";
  renderCommentList(task);
  render();
});

document.getElementById("attachmentInput").addEventListener("change", (e) => {
  const task = getTaskById(currentDetailTaskId);
  if (!task) return;
  const files = Array.from(e.target.files || []);
  e.target.value = "";
  if (files.length === 0) return;

  files.forEach((file) => {
    const id = uid();
    try {
      putAttachment(id, task.id, file.name, file.type, file)
        .then(() => {
          task.attachments.push({
            id,
            name: file.name,
            type: file.type,
            size: file.size,
            createdAt: Date.now(),
          });
          saveState();
          renderAttachmentList(task);
          render();
        })
        .catch(() => {});
    } catch (err) {}
  });
});

document.getElementById("closeTaskDetailBtn").addEventListener("click", () => {
  taskDetailDialog.close();
});

taskDetailDialog.addEventListener("close", () => {
  revokeDetailObjectUrls();
  currentDetailTaskId = null;
});

render();
