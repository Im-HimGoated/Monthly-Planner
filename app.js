(function () {
  const storageKey = "month-planner-events-v1";
  const monthInput = document.querySelector("#monthInput");
  const calendarGrid = document.querySelector("#calendarGrid");
  const eventForm = document.querySelector("#eventForm");
  const eventId = document.querySelector("#eventId");
  const titleInput = document.querySelector("#titleInput");
  const startInput = document.querySelector("#startInput");
  const endInput = document.querySelector("#endInput");
  const formTitle = document.querySelector("#formTitle");
  const formError = document.querySelector("#formError");
  const resetButton = document.querySelector("#resetButton");
  const deleteButton = document.querySelector("#deleteButton");
  const shareButton = document.querySelector("#shareButton");
  const shareBox = document.querySelector("#shareBox");
  const shareLink = document.querySelector("#shareLink");
  const copyButton = document.querySelector("#copyButton");
  const readonlyNotice = document.querySelector("#readonlyNotice");
  const appShell = document.querySelector(".app-shell");

  const today = new Date();
  let selectedMonth = toMonthValue(today);
  let events = [];
  let readonly = false;

  function init() {
    applyRouteMode();
    monthInput.value = selectedMonth;
    renderCalendar();
    bindEvents();
  }

  function applyRouteMode() {
    const sharedData = readSharedCalendar();
    if (sharedData) {
      readonly = true;
      events = sharedData.events;
      selectedMonth = sharedData.month || selectedMonth;
      appShell.classList.add("readonly");
      readonlyNotice.hidden = false;
      document.title = "Shared Month Planner";
    } else {
      readonly = false;
      events = loadEvents();
      appShell.classList.remove("readonly");
      readonlyNotice.hidden = true;
      document.title = "Month Planner";
    }
  }

  function bindEvents() {
    window.addEventListener("hashchange", () => {
      applyRouteMode();
      monthInput.value = selectedMonth;
      shareBox.hidden = true;
      resetForm();
      renderCalendar();
    });

    monthInput.addEventListener("change", () => {
      selectedMonth = monthInput.value;
      renderCalendar();
      resetForm();
    });

    eventForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (readonly) return;
      saveEvent();
    });

    resetButton.addEventListener("click", resetForm);
    deleteButton.addEventListener("click", deleteSelectedEvent);
    shareButton.addEventListener("click", createShareLink);
    copyButton.addEventListener("click", copyShareLink);
  }

  function renderCalendar() {
    calendarGrid.innerHTML = "";
    const [year, monthIndex] = selectedMonth.split("-").map(Number);
    const firstDay = new Date(year, monthIndex - 1, 1);
    const gridStart = new Date(firstDay);
    gridStart.setDate(firstDay.getDate() - firstDay.getDay());

    for (let index = 0; index < 42; index += 1) {
      const cellDate = new Date(gridStart);
      cellDate.setDate(gridStart.getDate() + index);
      calendarGrid.appendChild(createDayCell(cellDate, monthIndex - 1));
    }
  }

  function createDayCell(date, activeMonthIndex) {
    const cell = document.createElement("article");
    const dateKey = toDateValue(date);
    const dayEvents = eventsForDate(dateKey);
    cell.className = "day-cell";
    if (date.getMonth() !== activeMonthIndex) cell.classList.add("outside");
    if (dateKey === toDateValue(today)) cell.classList.add("today");

    const dateBar = document.createElement("div");
    dateBar.className = "date-number";

    const number = document.createElement("span");
    number.textContent = String(date.getDate());
    dateBar.appendChild(number);

    if (!readonly) {
      const addButton = document.createElement("button");
      addButton.className = "add-day-button";
      addButton.type = "button";
      addButton.textContent = "+";
      addButton.title = "Add event";
      addButton.setAttribute("aria-label", `Add event on ${formatReadableDate(date)}`);
      addButton.addEventListener("click", () => prepareNewEvent(dateKey));
      dateBar.appendChild(addButton);
    }

    const list = document.createElement("div");
    list.className = "event-list";
    dayEvents.forEach((plannerEvent) => {
      list.appendChild(createEventChip(plannerEvent));
    });

    cell.append(dateBar, list);
    return cell;
  }

  function createEventChip(plannerEvent) {
    const chip = document.createElement(readonly ? "div" : "button");
    chip.className = "event-chip";
    if (!readonly) chip.type = "button";

    const title = document.createElement("strong");
    title.textContent = plannerEvent.title;

    const time = document.createElement("span");
    time.textContent = formatEventTime(plannerEvent);

    chip.append(title, time);
    if (!readonly) {
      chip.addEventListener("click", () => editEvent(plannerEvent.id));
    }
    return chip;
  }

  function saveEvent() {
    const title = titleInput.value.trim();
    const start = startInput.value;
    const end = endInput.value;

    if (!title || !start || !end) {
      showError("Add a title, start, and end time.");
      return;
    }

    if (new Date(end) <= new Date(start)) {
      showError("End time must be after the start time.");
      return;
    }

    const updatedEvent = {
      id: eventId.value || createId(),
      title,
      start,
      end,
    };

    const existingIndex = events.findIndex((item) => item.id === updatedEvent.id);
    if (existingIndex >= 0) {
      events[existingIndex] = updatedEvent;
    } else {
      events.push(updatedEvent);
    }

    events.sort((a, b) => new Date(a.start) - new Date(b.start));
    persistEvents();
    selectedMonth = toMonthValue(new Date(start));
    monthInput.value = selectedMonth;
    renderCalendar();
    resetForm();
  }

  function editEvent(id) {
    const plannerEvent = events.find((item) => item.id === id);
    if (!plannerEvent) return;

    eventId.value = plannerEvent.id;
    titleInput.value = plannerEvent.title;
    startInput.value = plannerEvent.start;
    endInput.value = plannerEvent.end;
    formTitle.textContent = "Edit event";
    deleteButton.hidden = false;
    clearError();
  }

  function deleteSelectedEvent() {
    if (!eventId.value) return;
    events = events.filter((item) => item.id !== eventId.value);
    persistEvents();
    renderCalendar();
    resetForm();
  }

  function prepareNewEvent(dateValue) {
    resetForm();
    const start = `${dateValue}T15:30`;
    const end = `${dateValue}T16:30`;
    startInput.value = start;
    endInput.value = end;
    titleInput.focus();
  }

  function resetForm() {
    eventForm.reset();
    eventId.value = "";
    formTitle.textContent = "Add event";
    deleteButton.hidden = true;
    clearError();
  }

  function createShareLink() {
    const payload = {
      month: selectedMonth,
      events,
    };
    const encoded = encodePayload(payload);
    const url = `${window.location.origin}${window.location.pathname}#share=${encoded}`;
    shareLink.value = url;
    shareBox.hidden = false;
    shareLink.select();
  }

  async function copyShareLink() {
    if (!shareLink.value) return;
    try {
      await navigator.clipboard.writeText(shareLink.value);
      copyButton.textContent = "Copied";
      window.setTimeout(() => {
        copyButton.textContent = "Copy";
      }, 1400);
    } catch {
      shareLink.select();
    }
  }

  function readSharedCalendar() {
    const match = window.location.hash.match(/^#share=(.+)$/);
    if (!match) return null;

    try {
      const payload = decodePayload(match[1]);
      if (!Array.isArray(payload.events)) return null;
      return {
        month: payload.month,
        events: payload.events.filter(isValidEvent),
      };
    } catch {
      return null;
    }
  }

  function eventsForDate(dateValue) {
    return events
      .filter((plannerEvent) => eventTouchesDate(plannerEvent, dateValue))
      .sort((a, b) => new Date(a.start) - new Date(b.start));
  }

  function eventTouchesDate(plannerEvent, dateValue) {
    const dayStart = new Date(`${dateValue}T00:00`);
    const dayEnd = new Date(`${dateValue}T23:59:59`);
    return new Date(plannerEvent.start) <= dayEnd && new Date(plannerEvent.end) >= dayStart;
  }

  function persistEvents() {
    localStorage.setItem(storageKey, JSON.stringify(events));
  }

  function loadEvents() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
      return Array.isArray(saved) ? saved.filter(isValidEvent) : [];
    } catch {
      return [];
    }
  }

  function isValidEvent(plannerEvent) {
    return (
      plannerEvent &&
      typeof plannerEvent.id === "string" &&
      typeof plannerEvent.title === "string" &&
      typeof plannerEvent.start === "string" &&
      typeof plannerEvent.end === "string"
    );
  }

  function createId() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }

    return `event-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function showError(message) {
    formError.textContent = message;
    formError.hidden = false;
  }

  function clearError() {
    formError.textContent = "";
    formError.hidden = true;
  }

  function toMonthValue(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function toDateValue(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate()
    ).padStart(2, "0")}`;
  }

  function formatReadableDate(date) {
    return date.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatEventTime(plannerEvent) {
    const start = new Date(plannerEvent.start);
    const end = new Date(plannerEvent.end);
    const sameDay = toDateValue(start) === toDateValue(end);
    const timeOptions = { hour: "numeric", minute: "2-digit" };

    if (sameDay) {
      return `${start.toLocaleTimeString([], timeOptions)}-${end.toLocaleTimeString([], timeOptions)}`;
    }

    return `${start.toLocaleDateString([], { month: "short", day: "numeric" })} ${start.toLocaleTimeString(
      [],
      timeOptions
    )}-${end.toLocaleDateString([], { month: "short", day: "numeric" })} ${end.toLocaleTimeString(
      [],
      timeOptions
    )}`;
  }

  function encodePayload(payload) {
    const json = JSON.stringify(payload);
    return btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }

  function decodePayload(encoded) {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    return JSON.parse(decodeURIComponent(escape(atob(padded))));
  }

  init();
})();
