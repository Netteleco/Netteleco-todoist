const USERS_STORAGE_KEY = "todo-app-users-v1";
// Duplicated from app.js's COLORS palette under a different name: users.js is
// loaded before app.js, and re-declaring `const COLORS` in a second classic
// <script> on the same page throws a SyntaxError (top-level let/const share a
// single global lexical scope across script tags), so it needs its own name.
const USER_COLORS = ["#6366f1", "#ef4444", "#f59e0b", "#10b981", "#0ea5e9", "#a855f7", "#ec4899", "#64748b"];

function loadUsers() {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { users: [], currentUserId: null };
}

function saveUsers() {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(usersState));
}

// Small standalone id generator, duplicated from app.js's uid() so users.js
// does not depend on app.js having loaded yet (function declarations are
// safely redeclarable across classic <script> tags, unlike const/let).
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const usersState = loadUsers();

if (!usersState.users || usersState.users.length === 0) {
  const defaultUser = { id: uid(), name: "Yo", color: USER_COLORS[0] };
  usersState.users = [defaultUser];
  usersState.currentUserId = defaultUser.id;
  saveUsers();
}

function getCurrentUser() {
  return usersState.users.find((u) => u.id === usersState.currentUserId);
}

function getUserById(id) {
  if (!id) return undefined;
  return usersState.users.find((u) => u.id === id);
}

function userInitials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function renderUserSwitcher() {
  const avatar = document.getElementById("userSwitcherAvatar");
  const name = document.getElementById("userSwitcherName");
  if (!avatar || !name) return;
  const current = getCurrentUser();
  if (!current) {
    avatar.style.background = "var(--text-dim)";
    avatar.textContent = "?";
    name.textContent = "Sin usuario";
    return;
  }
  avatar.style.background = current.color;
  avatar.textContent = userInitials(current.name);
  name.textContent = current.name;
}

function renderAssigneeSelect() {
  const select = document.getElementById("taskAssignee");
  if (!select) return;
  const previousValue = select.value;
  select.innerHTML =
    `<option value="">Sin asignar</option>` +
    usersState.users.map((u) => `<option value="${escapeHtml(u.id)}">${escapeHtml(u.name)}</option>`).join("");
  if (usersState.users.some((u) => u.id === previousValue)) {
    select.value = previousValue;
  }
}

let selectedUserColor = USER_COLORS[0];

function renderUserColorPicker() {
  const picker = document.getElementById("userColorPicker");
  if (!picker) return;
  picker.innerHTML = "";
  USER_COLORS.forEach((color) => {
    const swatch = document.createElement("div");
    swatch.className = "color-swatch" + (color === selectedUserColor ? " selected" : "");
    swatch.style.background = color;
    swatch.addEventListener("click", () => {
      selectedUserColor = color;
      renderUserColorPicker();
    });
    picker.appendChild(swatch);
  });
}

function renderUserList() {
  const list = document.getElementById("userList");
  if (!list) return;
  list.innerHTML = "";
  usersState.users.forEach((user) => {
    const canDelete = usersState.users.length > 1;
    const li = document.createElement("li");
    li.className = "user-list-item" + (user.id === usersState.currentUserId ? " active" : "");
    li.innerHTML = `
      <span class="label">
        <span class="user-avatar small" style="background:${user.color}">${escapeHtml(userInitials(user.name))}</span>
        <span class="name">${escapeHtml(user.name)}</span>
        ${user.id === usersState.currentUserId ? '<span class="badge active-badge">Activo</span>' : ""}
      </span>
      <span style="display:flex;align-items:center;gap:6px;">
        ${user.id === usersState.currentUserId ? "" : `<button type="button" class="ghost-btn set-active-btn">Usar</button>`}
        <button type="button" class="delete-btn" title="Eliminar usuario" ${canDelete ? "" : "disabled"}>&times;</button>
      </span>
    `;

    const setActiveBtn = li.querySelector(".set-active-btn");
    if (setActiveBtn) {
      setActiveBtn.addEventListener("click", () => {
        switchUser(user.id);
      });
    }

    li.querySelector(".delete-btn").addEventListener("click", () => {
      deleteUser(user.id);
    });

    list.appendChild(li);
  });
}

function switchUser(id) {
  if (!getUserById(id)) return;
  usersState.currentUserId = id;
  saveUsers();
  renderUserSwitcher();
  renderUserList();
}

function deleteUser(id) {
  if (usersState.users.length <= 1) return;
  const user = getUserById(id);
  if (!user) return;
  if (!confirm(`Eliminar el usuario "${user.name}"?`)) return;

  usersState.users = usersState.users.filter((u) => u.id !== id);
  if (usersState.currentUserId === id) {
    usersState.currentUserId = usersState.users[0].id;
  }
  saveUsers();

  // Tasks are owned by app.js's `state`, which has already finished loading
  // by the time this runs (it's only reachable from a later user click, not
  // during initial script evaluation), so it's safe to reach across files.
  if (typeof state !== "undefined" && state.tasks) {
    let touched = false;
    state.tasks.forEach((task) => {
      if (task.assigneeId === id) {
        task.assigneeId = null;
        touched = true;
      }
    });
    if (touched && typeof saveState === "function") saveState();
  }

  renderUserSwitcher();
  renderUserList();
  renderAssigneeSelect();
  if (typeof render === "function") render();
}

function addUser(name, color) {
  const user = { id: uid(), name, color };
  usersState.users.push(user);
  saveUsers();
  renderUserSwitcher();
  renderUserList();
  renderAssigneeSelect();
}

const userDialog = document.getElementById("userDialog");

document.getElementById("userSwitcher").addEventListener("click", () => {
  renderUserList();
  document.getElementById("userName").value = "";
  selectedUserColor = USER_COLORS[usersState.users.length % USER_COLORS.length];
  renderUserColorPicker();
  userDialog.showModal();
});

document.getElementById("closeUserDialogBtn").addEventListener("click", () => {
  userDialog.close();
});

document.getElementById("userForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("userName").value.trim();
  if (!name) return;
  addUser(name, selectedUserColor);
  document.getElementById("userName").value = "";
  selectedUserColor = USER_COLORS[usersState.users.length % USER_COLORS.length];
  renderUserColorPicker();
});

renderUserSwitcher();
