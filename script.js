let STEP = 15;
const STORE = "work-scheduler-v2";
let scheduleStep = { value: 15, unit: "minute" };

const COLORS = [
  "#17a9df",
  "#18b777",
  "#ffc21a",
  "#ac8ee6",
  "#f28d75",
  "#75b95b",
  "#e99ac2"
];

let baseAvailability = {
  start: "07:00",
  end: "20:00"
};

let members = [
  member("A", "一般"),
  member("B", "一般"),
  member("C", "一般")
];

let tasks = [
  task("作業1", 480, 2, ""),
  task("作業2", 240, 2, ""),
  task("作業3", 120, 1, "")
];

let draggedTaskId = null;

const $ = (id) => document.getElementById(id);

const startEl = $("workStart");
const endEl = $("workEnd");
const memberList = $("memberList");
const taskList = $("taskList");
const resultArea = $("resultArea");
const resultMessage = $("resultMessage");
const stepValueEl = $("scheduleStepValue");
const stepUnitEl = $("scheduleStepUnit");

function revealAddedItem(selector) {
  requestAnimationFrame(() => {
    const target = document.querySelector(selector);

    if (!target) return;

    target.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    const input = target.querySelector(
      'input:not([type="hidden"]), select, textarea'
    );

    if (input) {
      window.setTimeout(() => {
        input.focus({ preventScroll: true });
      }, 350);
    }
  });
}

setDefaultDateTimes();
load();
syncStepInputs();
enhanceOverallDateTimeInputs();
initializeMemberAvailability();
render();
setupBaseAvailabilitySettings();
refreshForStepUnit();

$("addMember").onclick = () => {
  const newMember = member();
  newMember.availability = baseAvailabilityForPeriod();
  members.push(newMember);

  save();
  render();

  revealAddedItem("#memberList .member-card:last-child");
};

$("addTask").onclick = () => {
  const newTask = task();
  newTask.color = COLORS[tasks.length % COLORS.length];
  tasks.push(newTask);

  save();
  renderTasks();

  revealAddedItem("#taskList .task-card:last-child");
};

$("makeScheduleTop").onclick = makeSchedule;
$("makeScheduleBottom").onclick = makeSchedule;

$("addMemberTop").onclick = () => {
  $("addMember").click();
};

$("addTaskTop").onclick = () => {
  $("addTask").click();
};

const printButton = $("printSchedule");

if (printButton) {
  printButton.onclick = () => {
    if (resultArea.querySelector(".schedule")) {
      window.print();
    } else {
      toast("先に工程表を作成してください");
    }
  };
}

startEl.onchange = () => {
  startEl.value = normalizeDateTime(startEl.value);
  save();
};

endEl.onchange = () => {
  endEl.value = normalizeDateTime(endEl.value);
  save();
};

if (stepValueEl && stepUnitEl) {
  const updateStep = () => {
    const value = Math.max(
      1,
      Math.round(Number(stepValueEl.value) || 1)
    );

    stepValueEl.value = value;

    scheduleStep = {
      value,
      unit: stepUnitEl.value
    };

    STEP = stepToMinutes(scheduleStep);

    save();
    refreshForStepUnit();
  };

  stepValueEl.onchange = updateStep;
  stepUnitEl.onchange = updateStep;
}

function id() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  );
}

function member(name = "", skills = "") {
  return {
    id: id(),
    name,
    skills,
    availability: null,
    restRules: []
  };
}

function defaultAvailability() {
  return (
    baseAvailabilityForPeriod()[0] || {
      id: id(),
      start: dateTimeOnWorkDate(baseAvailability.start),
      end: dateTimeOnWorkDate(baseAvailability.end)
    }
  );
}

function baseAvailabilityForPeriod() {
  const workStart = parseDateTime(startEl.value);
  const workEnd = parseDateTime(endEl.value);

  if (!workStart || !workEnd || workEnd <= workStart) {
    return [];
  }

  const startMinutes = timeOnlyToMinutes(baseAvailability.start);
  const endMinutes = timeOnlyToMinutes(baseAvailability.end);

  if (
    startMinutes === null ||
    endMinutes === null ||
    endMinutes <= startMinutes
  ) {
    return [];
  }

  const availability = [];

  const currentDate = new Date(
    workStart.getFullYear(),
    workStart.getMonth(),
    workStart.getDate()
  );

  const lastDate = new Date(
    workEnd.getFullYear(),
    workEnd.getMonth(),
    workEnd.getDate()
  );

  while (currentDate <= lastDate) {
    const dailyStart = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate(),
      Math.floor(startMinutes / 60),
      startMinutes % 60
    );

    const dailyEnd = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate(),
      Math.floor(endMinutes / 60),
      endMinutes % 60
    );

    const actualStart = new Date(
      Math.max(dailyStart.getTime(), workStart.getTime())
    );

    const actualEnd = new Date(
      Math.min(dailyEnd.getTime(), workEnd.getTime())
    );

    if (actualEnd > actualStart) {
      availability.push({
        id: id(),
        start: localDateTime(actualStart),
        end: localDateTime(actualEnd)
      });
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return availability;
}

function initializeMemberAvailability() {
  members.forEach((currentMember) => {
    if (!Array.isArray(currentMember.availability)) {
      currentMember.availability = baseAvailabilityForPeriod();
    }

    if (!Array.isArray(currentMember.restRules)) {
      currentMember.restRules = [];
    }
  });
}

function setupBaseAvailabilitySettings() {
  const addMemberButton = $("addMember");

  if (!addMemberButton || $("baseAvailabilitySettings")) {
    return;
  }

  const settingsButton = button(
    "基底設定",
    "secondary basis-settings-button",
    () => {
      startInput.value = baseAvailability.start;
      endInput.value = baseAvailability.end;
      modal.classList.add("show");
    }
  );

  settingsButton.id = "baseAvailabilitySettings";

  addMemberButton.parentElement.insertBefore(
    settingsButton,
    addMemberButton
  );

  const modal = el("div", "base-modal");
  const panel = el("section", "base-modal-panel");
  const heading = el("h3");
  const description = el("p", "muted");
  const fields = el("div", "base-time-fields");
  const startLabel = el("label");
  const endLabel = el("label");
  const startInput = document.createElement("input");
  const endInput = document.createElement("input");
  const actions = el("div", "base-modal-actions");

  heading.textContent = "稼働時間の基底設定";
  description.textContent =
    "「基底に揃える」を押したメンバーに適用される時間です";

  startInput.type = "time";
  startInput.step = "900";
  startInput.value = baseAvailability.start;

  endInput.type = "time";
  endInput.step = "900";
  endInput.value = baseAvailability.end;

  startLabel.append(label("開始時刻"), startInput);
  endLabel.append(label("終了時刻"), endInput);
  fields.append(startLabel, endLabel);

  const closeModal = () => {
    modal.classList.remove("show");
  };

  actions.append(
    button("キャンセル", "secondary", closeModal),
    button("保存", "primary", () => {
      const startMinutes = timeOnlyToMinutes(startInput.value);
      const endMinutes = timeOnlyToMinutes(endInput.value);

      if (
        startMinutes === null ||
        endMinutes === null ||
        endMinutes <= startMinutes
      ) {
        toast("基底の開始時刻と終了時刻を確認してください");
        return;
      }

      if (startMinutes % STEP || endMinutes % STEP) {
        toast(`基底時間は${stepLabel()}単位で設定してください`);
        return;
      }

      baseAvailability = {
        start: startInput.value,
        end: endInput.value
      };

      save();
      closeModal();
      toast("稼働時間の基底を保存しました");
    })
  );

  panel.append(heading, description, fields, actions);
  modal.append(panel);

  modal.onclick = (event) => {
    if (event.target === modal) {
      closeModal();
    }
  };

  document.body.append(modal);
}

function timeOnlyToMinutes(value) {
  const match = String(value || "").match(/^(\d{2}):(\d{2})$/);

  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

function stepToMinutes(step) {
  const multiplier = {
    minute: 1,
    hour: 60,
    day: 1440
  }[step.unit] || 1;

  return Math.max(1, Number(step.value) || 1) * multiplier;
}

function syncStepInputs() {
  STEP = stepToMinutes(scheduleStep);

  if (stepValueEl) {
    stepValueEl.value = scheduleStep.value;
  }

  if (stepUnitEl) {
    stepUnitEl.value = scheduleStep.unit;
  }
}

function stepLabel() {
  const unitLabel = {
    minute: "分",
    hour: "時間",
    day: "日"
  }[scheduleStep.unit] || "分";

  return `${scheduleStep.value}${unitLabel}`;
}

function isDayMode() {
  return scheduleStep.unit === "day";
}

function startOfDateValue(value) {
  const date = parseDateTime(value);

  if (!date) return value;

  return localDateTime(
    new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    )
  );
}

function scheduleBounds() {
  const start = toMin(startOfDateValue(startEl.value));
  let end = toMin(startOfDateValue(endEl.value));

  // 日単位の場合は終了日も含める
  if (isDayMode() && end !== null) {
    end += 1440;
  }

  return { start, end };
}

function refreshForStepUnit() {
  document.body.classList.toggle("day-mode", isDayMode());

  $("workStartLabel").textContent =
    isDayMode() ? "開始日" : "開始日時";

  $("workEndLabel").textContent =
    isDayMode() ? "終了日" : "終了日時";

  $("overallSettingsDescription").textContent =
    isDayMode()
      ? "作業期間とメンバーを入力します"
      : "作業時間とメンバーを入力します";

  document
    .querySelectorAll(".overall-time .datetime-input")
    .forEach((element) => {
      element.remove();
    });

  [startEl, endEl].forEach((element) => {
    delete element.dataset.enhanced;
  });

  enhanceOverallDateTimeInputs();
  render();
}

function task(
  name = "",
  minutes = 60,
  people = 1,
  skill = ""
) {
  return {
    id: id(),
    name,
    minutes,
    start: "",
    people,
    skill,
    before: "",
    interruptible: true,
    shareable: false,
    color: ""
  };
}

function render() {
  renderMembers();
  renderTasks();
}

function renderMembers() {
  memberList.innerHTML = "";

  members.forEach((currentMember) => {
    const card = el("article", "member-card");
    const memberMain = el("div", "member-main");

    memberMain.append(
      textField(
        "名前",
        currentMember.name,
        (value) => {
          currentMember.name = value;
        }
      ),
      textField(
        "専門（複数は読点・カンマ区切り）",
        currentMember.skills,
        (value) => {
          currentMember.skills = value;
        },
        "",
        renderTasks
      ),
      button("削除", "delete", () => {
        members = members.filter(
          (memberItem) => memberItem.id !== currentMember.id
        );

        save();
        render();
      })
    );

    // 日単位では稼働時間・休憩の入力欄を表示しない
    if (isDayMode()) {
      card.append(memberMain);
      memberList.append(card);
      return;
    }

    const availabilityBox = el("div", "break-box");
    const availabilityHeader = el("div", "break-head");

    availabilityHeader.innerHTML = "<strong>稼働時間</strong>";

    const availabilityActions = el("div", "availability-actions");

    availabilityActions.append(
      button(
        "基底に揃える",
        "small basis-button",
        () => {
          currentMember.availability = baseAvailabilityForPeriod();

          save();
          renderMembers();
        }
      ),
      button("＋ 稼働時間を追加", "small", () => {
        currentMember.availability.push({
          id: id(),
          start: dateTimeOnWorkDate(baseAvailability.start),
          end: dateTimeOnWorkDate(baseAvailability.end)
        });

        save();
        renderMembers();
      })
    );

    availabilityHeader.append(availabilityActions);

    const availabilityList = el("div", "break-list");

    if (!currentMember.availability.length) {
      availabilityList.innerHTML =
        '<p class="muted">稼働時間なし（全時間が休憩になります）</p>';
    }

    currentMember.availability.forEach((availability) => {
      const row = el("div", "break-row");

      row.append(
        timeInput(
          availability.start,
          (value) => {
            availability.start = value;
          },
          "稼働開始"
        ),
        span("～", "dash"),
        timeInput(
          availability.end,
          (value) => {
            availability.end = value;
          },
          "稼働終了"
        ),
        button("削除", "delete", () => {
          currentMember.availability =
            currentMember.availability.filter(
              (item) => item.id !== availability.id
            );

          save();
          renderMembers();
        })
      );

      availabilityList.append(row);
    });

    availabilityBox.append(
      availabilityHeader,
      availabilityList
    );

    const restBox = el("div", "break-box");
    const restHeader = el("div", "break-head");

    restHeader.innerHTML = "<strong>休憩</strong>";

    restHeader.append(
      button("＋ 休憩を追加", "small", () => {
        currentMember.restRules.push({
          id: id(),
          type: "flexible",
          minutes: 60,
          start: dateTimeOnWorkDate("12:00"),
          end: dateTimeOnWorkDate("13:00")
        });

        save();
        renderMembers();
      })
    );

    const restList = el("div", "break-list");

    if (!currentMember.restRules.length) {
      restList.innerHTML =
        '<p class="muted">個別の休憩設定なし</p>';
    }

    currentMember.restRules.forEach((restRule) => {
      const row = el("div", "rest-row");
      const typeSelect = document.createElement("select");

      [
        ["flexible", "各稼働時間内に"],
        ["fixed", "時間を固定"]
      ].forEach(([value, text]) => {
        const option = document.createElement("option");

        option.value = value;
        option.textContent = text;
        option.selected = restRule.type === value;

        typeSelect.append(option);
      });

      typeSelect.setAttribute("aria-label", "休憩の指定方法");

      typeSelect.onchange = () => {
        restRule.type = typeSelect.value;

        save();
        renderMembers();
      };

      row.append(typeSelect);

      if (restRule.type === "fixed") {
        const fixedFields = el("div", "rest-fixed-fields");

        fixedFields.append(
          timeInput(
            restRule.start,
            (value) => {
              restRule.start = value;
            },
            "休憩開始"
          ),
          span("～", "dash"),
          timeInput(
            restRule.end,
            (value) => {
              restRule.end = value;
            },
            "休憩終了"
          )
        );

        row.append(fixedFields);
      } else {
        const flexibleFields = el("label", "rest-flex-fields");
        const minutesInput = document.createElement("input");

        minutesInput.type = "number";
        minutesInput.min = String(STEP);
        minutesInput.step = String(STEP);
        minutesInput.value = Math.max(
          15,
          Number(restRule.minutes) || 60
        );

        minutesInput.setAttribute("aria-label", "休憩時間（分）");

        minutesInput.oninput = () => {
          restRule.minutes = Math.max(
            15,
            Math.round(Number(minutesInput.value) || 15)
          );

          save();
        };

        flexibleFields.append(
          minutesInput,
          span("分とる", "rest-unit")
        );

        row.append(flexibleFields);
      }

      row.append(
        button("削除", "delete", () => {
          currentMember.restRules =
            currentMember.restRules.filter(
              (item) => item.id !== restRule.id
            );

          save();
          renderMembers();
        })
      );

      restList.append(row);
    });

    restBox.append(restHeader, restList);
    card.append(memberMain, availabilityBox, restBox);
    memberList.append(card);
  });
}

function renderTasks() {
  taskList.innerHTML = "";

  tasks.forEach((currentTask, index) => {
    currentTask.color =
      currentTask.color || COLORS[index % COLORS.length];

    const card = el("article", "task-card");

    card.style.setProperty("--card-color", currentTask.color);

    const accent = el("div", "accent");
    const body = el("div", "task-body");
    const header = el("div", "card-head");

    header.innerHTML = `<p>優先順位 ${index + 1}</p>`;

    const actions = el("div", "card-actions");

    const upButton = button("↑", "order-button", () => {
      moveTask(currentTask.id, -1);
    });

    const downButton = button("↓", "order-button", () => {
      moveTask(currentTask.id, 1);
    });

    const dragHandle = span("↕", "drag-handle");

    upButton.disabled = index === 0;
    downButton.disabled = index === tasks.length - 1;

    upButton.title = "優先順位を上げる";
    downButton.title = "優先順位を下げる";
    dragHandle.title = "ドラッグして並べ替え";
    dragHandle.draggable = true;

    dragHandle.addEventListener("dragstart", (event) => {
      draggedTaskId = currentTask.id;
      card.classList.add("dragging");

      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", currentTask.id);
    });

    dragHandle.addEventListener("dragend", () => {
      draggedTaskId = null;

      document.querySelectorAll(".task-card").forEach((taskCard) => {
        taskCard.classList.remove("dragging", "drag-over");
      });
    });

    card.addEventListener("dragover", (event) => {
      event.preventDefault();

      if (
        draggedTaskId &&
        draggedTaskId !== currentTask.id
      ) {
        card.classList.add("drag-over");
      }
    });

    card.addEventListener("dragleave", () => {
      card.classList.remove("drag-over");
    });

    card.addEventListener("drop", (event) => {
      event.preventDefault();
      card.classList.remove("drag-over");

      const sourceId =
        draggedTaskId ||
        event.dataTransfer.getData("text/plain");

      const insertAfter =
        event.clientY >
        card.getBoundingClientRect().top + card.offsetHeight / 2;

      reorderTask(sourceId, currentTask.id, insertAfter);
    });

    actions.append(
      upButton,
      downButton,
      dragHandle,
      button("削除", "delete", () => {
        const deletedId = currentTask.id;

        tasks = tasks.filter(
          (taskItem) => taskItem.id !== deletedId
        );

        tasks.forEach((taskItem) => {
          if (taskItem.before === deletedId) {
            taskItem.before = "";
          }
        });

        save();
        renderTasks();
      })
    );

    header.append(actions);

    const fields = el("div", "fields");

    fields.append(
      textField(
        "作業名",
        currentTask.name,
        (value) => {
          currentTask.name = value;
        },
        "wide"
      ),
      numberField(
        isDayMode() ? "所要日数" : "所要時間（分）",
        isDayMode()
          ? Math.max(
              1,
              Math.ceil(Number(currentTask.minutes) / 1440)
            )
          : currentTask.minutes,
        (value) => {
          currentTask.minutes = isDayMode() ? value * 1440 : value;
        }
      ),
      optionalTime(
        isDayMode() ? "開始日（任意）" : "開始日時（任意）",
        currentTask.start,
        (value) => {
          currentTask.start = value;
        }
      ),
      numberField(
        "必要人数（最低人数）",
        currentTask.people,
        (value) => {
          currentTask.people = value;
        }
      ),
      skillField(currentTask),
      beforeField(currentTask),
      checkField(
        "中断可能",
        currentTask.interruptible,
        (checked) => {
          currentTask.interruptible = checked;
        }
      ),
      checkField(
        "分担可能（空き人員も参加）",
        currentTask.shareable,
        (checked) => {
          currentTask.shareable = checked;
        }
      )
    );

    body.append(header, fields);
    card.append(accent, body);
    taskList.append(card);
  });
}

function textField(
  fieldLabel,
  value,
  onChange,
  className = "",
  changeHandler = null
) {
  const wrapper = el("label", className);
  wrapper.append(label(fieldLabel));

  const input = document.createElement("input");

  input.type = "text";
  input.value = value;

  input.oninput = () => {
    onChange(input.value);
    save();
  };

  if (changeHandler) {
    input.onchange = changeHandler;
  }

  wrapper.append(input);

  return wrapper;
}

function numberField(fieldLabel, value, onChange) {
  const wrapper = el("label");
  wrapper.append(label(fieldLabel));

  const input = document.createElement("input");

  input.type = "number";
  input.min = "1";
  input.step = "1";
  input.value = value;

  input.oninput = () => {
    const normalizedValue = Math.max(
      1,
      Math.round(Number(input.value) || 1)
    );

    onChange(normalizedValue);
    save();
  };

  wrapper.append(input);

  return wrapper;
}

function optionalTime(fieldLabel, value, onChange) {
  const wrapper = el("label");
  wrapper.append(label(fieldLabel));

  const control = dateTextInput(
    value,
    onChange,
    "開始日時"
  );

  wrapper.append(control);

  return wrapper;
}

function timeInput(value, onChange, ariaLabel) {
  return dateTextInput(value, onChange, ariaLabel);
}

function dateTextInput(value, onChange, ariaLabel) {
  return buildDateTimeControl(value, onChange, ariaLabel);
}

function enhanceOverallDateTimeInputs() {
  [
    [startEl, "全体の開始日時"],
    [endEl, "全体の終了日時"]
  ].forEach(([hiddenInput, ariaLabel]) => {
    if (!hiddenInput || hiddenInput.dataset.enhanced) {
      return;
    }

    const control = buildDateTimeControl(
      hiddenInput.value,
      (value) => {
        hiddenInput.value = value;
      },
      ariaLabel
    );

    hiddenInput.dataset.enhanced = "true";
    hiddenInput.type = "hidden";

    hiddenInput.parentElement.insertBefore(
      control,
      hiddenInput
    );
  });
}

function buildDateTimeControl(value, onChange, ariaLabel) {
  const wrapper = el("div", "datetime-input");
  const dateInput = document.createElement("input");
  const timeInputElement = document.createElement("input");

  const parsedDate = parseDateTime(normalizeDateTime(value));

  dateInput.type = "date";
  dateInput.setAttribute("aria-label", ariaLabel + "の日付");

  timeInputElement.type = "text";
  timeInputElement.inputMode = "numeric";
  timeInputElement.placeholder = "09:00";
  timeInputElement.maxLength = 5;
  timeInputElement.setAttribute(
    "aria-label",
    ariaLabel + "の時刻"
  );

  if (parsedDate) {
    const normalized = localDateTime(parsedDate);

    dateInput.value = normalized.slice(0, 10);
    timeInputElement.value = normalized.slice(11, 16);
  }

  if (isDayMode()) {
    timeInputElement.hidden = true;
  }

  const updateValue = () => {
    if (!dateInput.value) {
      onChange("");
      save();
      return;
    }

    if (isDayMode()) {
      onChange(dateInput.value + " 00:00");
      save();
      return;
    }

    if (!timeInputElement.value.trim()) {
      return;
    }

    const normalizedTime =
      normalizeTypedTime(timeInputElement.value);

    if (!normalizedTime) {
      toast("時刻は「09:00」の形式で入力してください");
      return;
    }

    const dateTimeValue =
      dateInput.value + " " + normalizedTime;

    if (parseDateTime(dateTimeValue)) {
      timeInputElement.value = normalizedTime;
      onChange(dateTimeValue);
      save();
    } else {
      toast("日時を確認してください");
    }
  };

  dateInput.onchange = updateValue;
  timeInputElement.onchange = updateValue;

  wrapper.append(dateInput, timeInputElement);

  return wrapper;
}

function normalizeTypedTime(value) {
  const text = String(value || "")
    .trim()
    .replace(/：/g, ":");

  let hours;
  let minutes;

  if (/^\d{3,4}$/.test(text)) {
    const padded = text.padStart(4, "0");

    hours = Number(padded.slice(0, 2));
    minutes = Number(padded.slice(2, 4));
  } else {
    const match = text.match(/^(\d{1,2}):(\d{1,2})$/);

    if (!match) return null;

    hours = Number(match[1]);
    minutes = Number(match[2]);
  }

  if (
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return (
    String(hours).padStart(2, "0") +
    ":" +
    String(minutes).padStart(2, "0")
  );
}

function skillField(currentTask) {
  const wrapper = el("fieldset", "skill-checkbox-field");
  const heading = el("legend");

  heading.textContent = "専門性（複数選択可）";
  wrapper.append(heading);

  const registeredSkills = [
    ...new Set(
      members.flatMap(
        (currentMember) => skills(currentMember.skills)
      )
    )
  ];

  const selectedSkills = skills(currentTask.skill);

  const choices = [
    ...new Set([
      ...registeredSkills,
      ...selectedSkills
    ])
  ];

  if (!choices.length) {
    const emptyMessage = el("p", "skill-empty");

    emptyMessage.textContent =
      "メンバーの専門を先に入力してください";

    wrapper.append(emptyMessage);
    return wrapper;
  }

  const checkboxList = el("div", "skill-checkbox-list");

  choices.forEach((skillName) => {
    const item = el("label", "skill-checkbox-item");
    const checkbox = document.createElement("input");
    const text = document.createElement("span");

    checkbox.type = "checkbox";
    checkbox.value = skillName;
    checkbox.checked = selectedSkills.includes(skillName);

    text.textContent = registeredSkills.includes(skillName)
      ? skillName
      : `${skillName}（未登録）`;

    checkbox.onchange = () => {
      const checkedSkills = [
        ...checkboxList.querySelectorAll(
          'input[type="checkbox"]:checked'
        )
      ].map((checkedCheckbox) => checkedCheckbox.value);

      currentTask.skill = checkedSkills.join("、");
      save();
    };

    item.append(checkbox, text);
    checkboxList.append(item);
  });

  wrapper.append(checkboxList);

  return wrapper;
}

function beforeField(currentTask) {
  const wrapper = el("label");
  wrapper.append(label("前工程（任意）"));

  const select = document.createElement("select");

  select.innerHTML = '<option value="">なし</option>';

  tasks
    .filter((taskItem) => taskItem.id !== currentTask.id)
    .forEach((taskItem) => {
      const option = document.createElement("option");

      option.value = taskItem.id;
      option.textContent = taskItem.name || "名称未入力";
      option.selected = currentTask.before === taskItem.id;

      select.append(option);
    });

  select.onchange = () => {
    currentTask.before = select.value;
    save();
  };

  wrapper.append(select);

  return wrapper;
}

function checkField(fieldLabel, checked, onChange) {
  const wrapper = el("label", "check-field");
  const text = span(fieldLabel, "label");
  const input = document.createElement("input");

  input.type = "checkbox";
  input.checked = checked;

  input.onchange = () => {
    onChange(input.checked);
    save();
  };

  wrapper.append(text, input);

  return wrapper;
}

function el(tagName, className = "") {
  const element = document.createElement(tagName);

  if (className) {
    element.className = className;
  }

  return element;
}

function span(text, className = "") {
  const element = el("span", className);
  element.textContent = text;

  return element;
}

function label(text) {
  return span(text);
}

function button(text, className, onClick) {
  const element = el("button", className);

  element.type = "button";
  element.textContent = text;
  element.onclick = onClick;

  return element;
}

function moveTask(taskId, direction) {
  const currentIndex = tasks.findIndex(
    (taskItem) => taskItem.id === taskId
  );

  const newIndex = currentIndex + direction;

  if (
    currentIndex < 0 ||
    newIndex < 0 ||
    newIndex >= tasks.length
  ) {
    return;
  }

  const [movedTask] = tasks.splice(currentIndex, 1);
  tasks.splice(newIndex, 0, movedTask);

  save();
  renderTasks();
}

function reorderTask(sourceId, targetId, insertAfter) {
  if (!sourceId || sourceId === targetId) {
    return;
  }

  const sourceIndex = tasks.findIndex(
    (taskItem) => taskItem.id === sourceId
  );

  if (
    sourceIndex < 0 ||
    !tasks.some((taskItem) => taskItem.id === targetId)
  ) {
    return;
  }

  const [movedTask] = tasks.splice(sourceIndex, 1);

  const targetIndex = tasks.findIndex(
    (taskItem) => taskItem.id === targetId
  );

  tasks.splice(
    targetIndex + (insertAfter ? 1 : 0),
    0,
    movedTask
  );

  save();
  renderTasks();
}

function makeSchedule() {
  save();

  const {
    start: workStart,
    end: workEnd
  } = scheduleBounds();

  const activeMembers = members.filter(
    (currentMember) => currentMember.name.trim()
  );

  const activeTasks = tasks.filter(
    (currentTask) => currentTask.name.trim()
  );

  if (
    workStart === null ||
    workEnd === null ||
    workEnd <= workStart
  ) {
    toast("全体の開始・終了日時を確認してください");
    return;
  }

  if (!activeMembers.length) {
    toast("メンバーを1人以上入力してください");
    return;
  }

  if (!activeTasks.length) {
    toast("作業を1件以上入力してください");
    return;
  }

  if ((workEnd - workStart) % STEP) {
    toast(`全体の時刻は${stepLabel()}単位で設定してください`);
    return;
  }

  if (!isDayMode()) {
    for (const currentMember of activeMembers) {
      for (const availability of currentMember.availability) {
        const availabilityStart = toMin(availability.start);
        const availabilityEnd = toMin(availability.end);

        if (
          availabilityStart === null ||
          availabilityEnd === null
        ) {
          toast(
            `${currentMember.name}さんの稼働日時は「2026-09-03 07:00」の形式で入力してください`
          );
          return;
        }

        if (
          availabilityEnd <= availabilityStart ||
          availabilityStart < workStart ||
          availabilityEnd > workEnd
        ) {
          toast(
            `${currentMember.name}さんの稼働日時を全体時間内で確認してください`
          );
          return;
        }

        if (
          (availabilityStart - workStart) % STEP ||
          (availabilityEnd - workStart) % STEP
        ) {
          toast(
            `${currentMember.name}さんの稼働時間を${stepLabel()}単位で設定してください`
          );
          return;
        }
      }

      const availableSlots = new Set();

      currentMember.availability.forEach((availability) => {
        const firstSlot =
          (toMin(availability.start) - workStart) / STEP;

        const lastSlot =
          (toMin(availability.end) - workStart) / STEP;

        for (let slot = firstSlot; slot < lastSlot; slot++) {
          availableSlots.add(slot);
        }
      });

      const fixedRestSlots = new Set();
      let flexibleRestMinutes = 0;

      for (const restRule of currentMember.restRules) {
        if (restRule.type === "fixed") {
          const restStart = toMin(restRule.start);
          const restEnd = toMin(restRule.end);

          if (restStart === null || restEnd === null) {
            toast(
              `${currentMember.name}さんの固定休憩は「2026-09-03 12:00」の形式で入力してください`
            );
            return;
          }

          if (
            restEnd <= restStart ||
            restStart < workStart ||
            restEnd > workEnd
          ) {
            toast(
              `${currentMember.name}さんの固定休憩を全体時間内で確認してください`
            );
            return;
          }

          if (
            (restStart - workStart) % STEP ||
            (restEnd - workStart) % STEP
          ) {
            toast(
              `${currentMember.name}さんの固定休憩を${stepLabel()}単位で設定してください`
            );
            return;
          }

          const restLastSlot = (restEnd - workStart) / STEP;

          for (
            let slot = (restStart - workStart) / STEP;
            slot < restLastSlot;
            slot++
          ) {
            if (!availableSlots.has(slot)) {
              toast(
                `${currentMember.name}さんの固定休憩は稼働時間内に設定してください`
              );
              return;
            }

            fixedRestSlots.add(slot);
          }
        } else {
          const minutes = Number(restRule.minutes);

          if (
            !Number.isFinite(minutes) ||
            minutes <= 0 ||
            minutes % STEP
          ) {
            toast(
              `${currentMember.name}さんの休憩時間を${stepLabel()}単位で設定してください`
            );
            return;
          }

          flexibleRestMinutes += minutes;
        }
      }

      const cannotFitRest = currentMember.availability.some(
        (availability) => {
          const firstSlot =
            (toMin(availability.start) - workStart) / STEP;

          const lastSlot =
            (toMin(availability.end) - workStart) / STEP;

          let fixedRestCount = 0;

          for (let slot = firstSlot; slot < lastSlot; slot++) {
            if (fixedRestSlots.has(slot)) {
              fixedRestCount++;
            }
          }

          return (
            flexibleRestMinutes / STEP >
            lastSlot - firstSlot - fixedRestCount
          );
        }
      );

      if (cannotFitRest) {
        toast(
          `${currentMember.name}さんの各稼働時間内に、指定された休憩時間を確保できません`
        );
        return;
      }
    }
  }

  for (const currentTask of activeTasks) {
    if (!currentTask.start) continue;

    const taskStart = toMin(
      isDayMode()
        ? startOfDateValue(currentTask.start)
        : currentTask.start
    );

    if (taskStart === null) {
      toast(
        `${currentTask.name}の開始日時は「2026-09-03 09:00」の形式で入力してください`
      );
      return;
    }

    if ((taskStart - workStart) % STEP) {
      toast(
        `${currentTask.name}の開始時刻は${stepLabel()}単位で設定してください`
      );
      return;
    }
  }

  draw(
    createSchedule(
      activeTasks,
      activeMembers,
      workStart,
      workEnd
    ),
    activeMembers,
    workStart
  );

  $("resultSection").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function createSchedule(
  activeTasks,
  activeMembers,
  workStart,
  workEnd
) {
  const slotCount = (workEnd - workStart) / STEP;

  const cells = Object.fromEntries(
    activeMembers.map((currentMember) => [
      currentMember.id,
      Array.from(
        { length: slotCount },
        () => ({ type: "break" })
      )
    ])
  );

  const completed = {};
  const failed = [];
  const processing = new Set();

  activeMembers.forEach((currentMember) => {
    if (isDayMode()) {
      for (let slot = 0; slot < slotCount; slot++) {
        cells[currentMember.id][slot] = null;
      }
      return;
    }

    currentMember.availability.forEach((availability) => {
      const firstSlot =
        (toMin(availability.start) - workStart) / STEP;

      const lastSlot =
        (toMin(availability.end) - workStart) / STEP;

      for (let slot = firstSlot; slot < lastSlot; slot++) {
        cells[currentMember.id][slot] = null;
      }
    });

    currentMember.restRules
      .filter((restRule) => restRule.type === "fixed")
      .forEach((restRule) => {
        const firstSlot =
          (toMin(restRule.start) - workStart) / STEP;

        const lastSlot =
          (toMin(restRule.end) - workStart) / STEP;

        for (let slot = firstSlot; slot < lastSlot; slot++) {
          cells[currentMember.id][slot] = {
            type: "break",
            breakKind: "fixed"
          };
        }
      });
  });

  const taskMap = Object.fromEntries(
    activeTasks.map((currentTask) => [
      currentTask.id,
      currentTask
    ])
  );

  function addFailure(currentTask, reason) {
    const alreadyFailed = failed.some(
      (failedItem) => failedItem.task.id === currentTask.id
    );

    if (!alreadyFailed) {
      failed.push({
        task: currentTask,
        reason
      });
    }
  }

  function placeTask(currentTask, latestSlot = slotCount) {
    if (completed[currentTask.id]) {
      return completed[currentTask.id];
    }

    if (processing.has(currentTask.id)) {
      addFailure(currentTask, "前工程が循環しています");
      return null;
    }

    processing.add(currentTask.id);

    let earliestSlot = 0;

    if (currentTask.before) {
      const previousTask = taskMap[currentTask.before];

      if (!previousTask) {
        addFailure(currentTask, "前工程が見つかりません");
        processing.delete(currentTask.id);
        return null;
      }

      const previousResult = placeTask(
        previousTask,
        currentTask.start
          ? (
              toMin(
                isDayMode()
                  ? startOfDateValue(currentTask.start)
                  : currentTask.start
              ) - workStart
            ) / STEP
          : latestSlot
      );

      if (!previousResult) {
        addFailure(currentTask, "前工程を配置できません");
        processing.delete(currentTask.id);
        return null;
      }

      earliestSlot = previousResult.end;
    }

    const missingSkills = skills(currentTask.skill).filter(
      (requiredSkill) =>
        !activeMembers.some(
          (currentMember) =>
            skills(currentMember.skills).includes(requiredSkill)
        )
    );

    if (missingSkills.length) {
      addFailure(
        currentTask,
        `専門「${missingSkills.join("、")}」を持つメンバーがいません`
      );
      processing.delete(currentTask.id);
      return null;
    }

    const fixedStart = currentTask.start
      ? (
          toMin(
            isDayMode()
              ? startOfDateValue(currentTask.start)
              : currentTask.start
          ) - workStart
        ) / STEP
      : null;

    if (
      fixedStart !== null &&
      (fixedStart < 0 || fixedStart >= slotCount)
    ) {
      addFailure(currentTask, "開始日時が全体の時間外です");
      processing.delete(currentTask.id);
      return null;
    }

    if (
      fixedStart !== null &&
      fixedStart < earliestSlot
    ) {
      addFailure(
        currentTask,
        "開始日時が前工程の完了より前です"
      );
      processing.delete(currentTask.id);
      return null;
    }

    const plan = currentTask.shareable
      ? planShareable(
          currentTask,
          activeMembers,
          cells,
          fixedStart ?? earliestSlot,
          latestSlot,
          fixedStart !== null
        )
      : planTogether(
          currentTask,
          activeMembers,
          cells,
          fixedStart ?? earliestSlot,
          latestSlot,
          fixedStart !== null
        );

    if (!plan) {
      addFailure(
        currentTask,
        "必要な人数、専門性、または時間枠を確保できません"
      );
      processing.delete(currentTask.id);
      return null;
    }

    plan.parts.forEach((part) => {
      for (let slot = part.start; slot < part.end; slot++) {
        cells[part.memberId][slot] = {
          type: "task",
          task: currentTask
        };
      }
    });

    completed[currentTask.id] = {
      ...plan,
      task: currentTask
    };

    processing.delete(currentTask.id);

    return completed[currentTask.id];
  }

  activeTasks
    .filter((currentTask) => currentTask.start)
    .sort(
      (firstTask, secondTask) =>
        toMin(firstTask.start) - toMin(secondTask.start)
    )
    .forEach((currentTask) => {
      placeTask(currentTask);
    });

  activeTasks
    .filter((currentTask) => !currentTask.start)
    .forEach((currentTask) => {
      placeTask(currentTask);
    });

  if (!isDayMode()) {
    allocateFlexibleBreaks(
      cells,
      completed,
      failed,
      activeTasks,
      activeMembers,
      slotCount,
      workStart
    );
  }

  return {
    cells,
    done: Object.values(completed),
    failed,
    slotCount
  };
}

function allocateFlexibleBreaks(
  cells,
  completed,
  failed,
  activeTasks,
  activeMembers,
  slotCount,
  workStart
) {
  const requiredBreakSlots = Object.fromEntries(
    activeMembers.map((currentMember) => [
      currentMember.id,
      currentMember.restRules
        .filter((restRule) => restRule.type !== "fixed")
        .reduce(
          (total, restRule) =>
            total + Math.ceil(Number(restRule.minutes) / STEP),
          0
        )
    ])
  );

  const taskPriority = Object.fromEntries(
    activeTasks.map((currentTask, index) => [
      currentTask.id,
      index
    ])
  );

  const clearFlexibleBreaks = () => {
    activeMembers.forEach((currentMember) => {
      for (let slot = 0; slot < slotCount; slot++) {
        const cell = cells[currentMember.id][slot];

        if (
          cell &&
          cell.type === "break" &&
          cell.breakKind === "flexible"
        ) {
          cells[currentMember.id][slot] = null;
        }
      }
    });
  };

  for (
    let attempt = 0;
    attempt <= activeTasks.length;
    attempt++
  ) {
    clearFlexibleBreaks();

    const membersWithoutBreaks = [];

    activeMembers.forEach((currentMember) => {
      currentMember.availability.forEach((availability) => {
        let remaining = requiredBreakSlots[currentMember.id];

        const firstSlot =
          (toMin(availability.start) - workStart) / STEP;

        const lastSlot =
          (toMin(availability.end) - workStart) / STEP;

        for (
          let slot = firstSlot;
          slot < lastSlot && remaining > 0;
          slot++
        ) {
          if (cells[currentMember.id][slot] === null) {
            cells[currentMember.id][slot] = {
              type: "break",
              breakKind: "flexible"
            };

            remaining--;
          }
        }

        if (
          remaining > 0 &&
          !membersWithoutBreaks.includes(currentMember.id)
        ) {
          membersWithoutBreaks.push(currentMember.id);
        }
      });
    });

    if (!membersWithoutBreaks.length) {
      return;
    }

    const affectedMemberIds = new Set(membersWithoutBreaks);

    const taskToRemove = Object.values(completed)
      .filter((result) =>
        result.parts.some((part) =>
          affectedMemberIds.has(part.memberId)
        )
      )
      .sort(
        (firstResult, secondResult) =>
          (taskPriority[secondResult.task.id] ?? -1) -
          (taskPriority[firstResult.task.id] ?? -1)
      )[0];

    if (!taskToRemove) {
      return;
    }

    const removedTaskIds = new Set([
      taskToRemove.task.id
    ]);

    let changed = true;

    while (changed) {
      changed = false;

      activeTasks.forEach((currentTask) => {
        if (
          currentTask.before &&
          removedTaskIds.has(currentTask.before) &&
          completed[currentTask.id] &&
          !removedTaskIds.has(currentTask.id)
        ) {
          removedTaskIds.add(currentTask.id);
          changed = true;
        }
      });
    }

    activeMembers.forEach((currentMember) => {
      for (let slot = 0; slot < slotCount; slot++) {
        const cell = cells[currentMember.id][slot];

        if (
          cell &&
          cell.type === "task" &&
          removedTaskIds.has(cell.task.id)
        ) {
          cells[currentMember.id][slot] = null;
        }
      }
    });

    removedTaskIds.forEach((taskId) => {
      const removedResult = completed[taskId];

      if (!removedResult) return;

      delete completed[taskId];

      const alreadyFailed = failed.some(
        (failedItem) => failedItem.task.id === taskId
      );

      if (!alreadyFailed) {
        failed.push({
          task: removedResult.task,
          reason:
            taskId === taskToRemove.task.id
              ? "休憩時間を確保するため、優先順位に基づいて配置から外しました"
              : "前工程が休憩時間の確保により配置から外れました"
        });
      }
    });
  }
}

function planTogether(
  currentTask,
  activeMembers,
  cells,
  startSlot,
  latestSlot,
  fixedStart
) {
  const requiredPeople = Math.max(
    1,
    Number(currentTask.people)
  );

  const requiredSlots = Math.ceil(
    Number(currentTask.minutes) / STEP
  );

  if (activeMembers.length < requiredPeople) {
    return null;
  }

  const memberGroups = combinations(
    activeMembers,
    requiredPeople
  ).filter((group) =>
    coversSkills(group, currentTask.skill)
  );

  for (const group of memberGroups) {
    const possibleStarts = fixedStart
      ? [startSlot]
      : Array.from(
          {
            length: Math.max(0, latestSlot - startSlot)
          },
          (_, index) => startSlot + index
        );

    for (const possibleStart of possibleStarts) {
      let selectedSlots = [];

      if (currentTask.interruptible) {
        for (
          let slot = possibleStart;
          slot < latestSlot &&
          selectedSlots.length < requiredSlots;
          slot++
        ) {
          const allAvailable = group.every(
            (currentMember) => !cells[currentMember.id][slot]
          );

          if (allAvailable) {
            selectedSlots.push(slot);
          }
        }
      } else {
        selectedSlots = Array.from(
          { length: requiredSlots },
          (_, index) => possibleStart + index
        );

        const outsidePeriod =
          selectedSlots.at(-1) >= latestSlot;

        const hasConflict = selectedSlots.some((slot) =>
          group.some(
            (currentMember) => cells[currentMember.id][slot]
          )
        );

        if (outsidePeriod || hasConflict) {
          continue;
        }
      }

      if (
        selectedSlots.length < requiredSlots ||
        selectedSlots[0] !== possibleStart
      ) {
        continue;
      }

      const parts = [];

      group.forEach((currentMember) => {
        ranges(selectedSlots).forEach((range) => {
          parts.push({
            memberId: currentMember.id,
            ...range
          });
        });
      });

      return {
        parts,
        start: possibleStart,
        end: selectedSlots.at(-1) + 1
      };
    }
  }

  return null;
}

function planShareable(
  currentTask,
  activeMembers,
  cells,
  startSlot,
  latestSlot,
  fixedStart
) {
  const requiredPeople = Math.max(
    1,
    Number(currentTask.people)
  );

  const requiredWork =
    Math.ceil(Number(currentTask.minutes) / STEP) *
    requiredPeople;

  const possibleStarts = fixedStart
    ? [startSlot]
    : Array.from(
        {
          length: Math.max(0, latestSlot - startSlot)
        },
        (_, index) => startSlot + index
      );

  if (activeMembers.length < requiredPeople) {
    return null;
  }

  for (const possibleStart of possibleStarts) {
    let remainingWork = requiredWork;
    const memberSlots = {};

    let started = false;
    let interruptionFound = false;
    let lastSlot = possibleStart - 1;
    let actualStart = null;

    for (
      let slot = possibleStart;
      slot < latestSlot && remainingWork > 0;
      slot++
    ) {
      const availableMembers = activeMembers.filter(
        (currentMember) => !cells[currentMember.id][slot]
      );

      if (
        availableMembers.length >= requiredPeople &&
        coversSkills(availableMembers, currentTask.skill)
      ) {
        if (
          slot === possibleStart ||
          started ||
          !fixedStart
        ) {
          if (
            !currentTask.interruptible &&
            interruptionFound
          ) {
            break;
          }

          if (!started) {
            actualStart = slot;
          }

          const selectedMembers = chooseWorkers(
            availableMembers,
            Math.min(
              availableMembers.length,
              Math.max(requiredPeople, remainingWork)
            ),
            currentTask.skill
          );

          if (!selectedMembers) {
            if (fixedStart && slot === possibleStart) {
              break;
            }

            continue;
          }

          started = true;

          selectedMembers.forEach((currentMember) => {
            if (!memberSlots[currentMember.id]) {
              memberSlots[currentMember.id] = [];
            }

            memberSlots[currentMember.id].push(slot);
          });

          remainingWork -= selectedMembers.length;
          lastSlot = slot;
        }
      } else {
        if (slot === possibleStart && fixedStart) {
          break;
        }

        if (started) {
          interruptionFound = true;
        }

        if (!currentTask.interruptible && started) {
          break;
        }
      }
    }

    if (remainingWork <= 0 && started) {
      const parts = [];

      Object.entries(memberSlots).forEach(([memberId, slots]) => {
        ranges(slots).forEach((range) => {
          parts.push({
            memberId,
            ...range
          });
        });
      });

      return {
        parts,
        start: actualStart,
        end: lastSlot + 1
      };
    }
  }

  return null;
}

function ranges(slots) {
  const result = [];

  if (!slots.length) return result;

  let start = slots[0];
  let end = start + 1;

  for (let index = 1; index < slots.length; index++) {
    if (slots[index] === end) {
      end++;
    } else {
      result.push({ start, end });

      start = slots[index];
      end = start + 1;
    }
  }

  result.push({ start, end });

  return result;
}

function combinations(items, count) {
  const result = [];

  function build(startIndex, selectedItems) {
    if (selectedItems.length === count) {
      result.push([...selectedItems]);
      return;
    }

    const remaining = count - selectedItems.length;

    for (
      let index = startIndex;
      index <= items.length - remaining;
      index++
    ) {
      selectedItems.push(items[index]);
      build(index + 1, selectedItems);
      selectedItems.pop();
    }
  }

  build(0, []);

  return result;
}

function skills(value) {
  return String(value || "")
    .split(/[,、，]/)
    .map((skill) => skill.trim())
    .filter(Boolean);
}

function coversSkills(selectedMembers, requiredSkills) {
  return skills(requiredSkills).every((requiredSkill) =>
    selectedMembers.some((currentMember) =>
      skills(currentMember.skills).includes(requiredSkill)
    )
  );
}

function chooseWorkers(
  availableMembers,
  requestedCount,
  requiredSkills
) {
  for (
    let count = Math.max(1, requestedCount);
    count <= availableMembers.length;
    count++
  ) {
    const selected = combinations(
      availableMembers,
      count
    ).find((group) =>
      coversSkills(group, requiredSkills)
    );

    if (selected) return selected;
  }

  return null;
}

/* 工程表の描画 */
function draw(scheduleData, activeMembers, workStart) {
  resultArea.innerHTML = "";

  resultMessage.textContent =
    `${scheduleData.done.length}件を配置しました`;

  const completedTasks = [
    ...new Map(
      scheduleData.done.map((result) => [
        result.task.id,
        result.task
      ])
    ).values()
  ];

  if (completedTasks.length) {
    const legend = el("div", "legend");

    completedTasks.forEach((currentTask) => {
      const item = el("div", "legend-item");
      const swatch = el("span", "swatch");

      swatch.style.background = currentTask.color;

      item.append(
        swatch,
        document.createTextNode(currentTask.name)
      );

      legend.append(item);
    });

    resultArea.append(legend);
  }

  const schedule = el("div", "schedule");

  // 全員に作業・休憩がない連続区間を1列にまとめる
  const columns = [];
  const slotToColumn = [];

  for (let slot = 0; slot < scheduleData.slotCount;) {
    const occupied = (index) =>
      activeMembers.some((currentMember) => {
        const cell = scheduleData.cells[currentMember.id][index];

        return (
          cell &&
          (cell.type !== "break" || cell.breakKind)
        );
      });

    if (occupied(slot)) {
      slotToColumn[slot] = columns.length;

      columns.push({
        start: slot,
        end: slot + 1,
        gap: false
      });

      slot++;
    } else {
      let end = slot + 1;

      while (
        end < scheduleData.slotCount &&
        !occupied(end)
      ) {
        end++;
      }

      columns.push({
        start: slot,
        end,
        gap: true
      });

      slot = end;
    }
  }

  schedule.style.setProperty("--slots", columns.length);

  const unitWidth = Number($("axisZoom").value) || 24;

  const tracks = columns
    .map((column) =>
      column.gap ? "28px" : `${unitWidth}px`
    )
    .join(" ");

  schedule.style.setProperty("--axis-tracks", tracks);

  schedule.style.setProperty(
    "--print-tracks",
    columns
      .map((column) =>
        column.gap ? "14px" : "minmax(0, 1fr)"
      )
      .join(" ")
  );

  const header = el("div", "timeline-row");
  const nameHeader = el("div", "name-cell");

  nameHeader.textContent = "作業者名";
  header.append(nameHeader);

  columns.forEach((column, index) => {
    const timeCell = el(
      "div",
      column.gap
        ? "time-cell gap-cell"
        : "time-cell hour-line"
    );

    timeCell.style.gridColumn = index + 2;

    if (column.gap) {
      timeCell.title =
        `省略：${clock(workStart + column.start * STEP)}` +
        ` ～ ${clock(workStart + column.end * STEP)}`;

      timeCell.setAttribute("aria-label", timeCell.title);
    } else if (
      index === 0 ||
      columns[index - 1].gap ||
      isDayMode() ||
      column.start % 4 === 0
    ) {
      timeCell.textContent =
        clock(workStart + column.start * STEP);
    }

    header.append(timeCell);
  });

  schedule.append(header);

  activeMembers.forEach((currentMember) => {
    const row = el("div", "timeline-row");
    const name = el("div", "name-cell");

    name.textContent = currentMember.name;
    row.append(name);

    columns.forEach((column, index) => {
      const grid = el(
        "div",
        column.gap
          ? "grid-cell gap-cell"
          : "grid-cell " +
            (column.start % 4 === 0 ? "hour-line" : "")
      );

      grid.style.gridColumn = index + 2;
      row.append(grid);
    });

    for (let slot = 0; slot < scheduleData.slotCount;) {
      const cell = scheduleData.cells[currentMember.id][slot];

      if (!cell || slotToColumn[slot] === undefined) {
        slot++;
        continue;
      }

      let end = slot + 1;

      while (
        end < scheduleData.slotCount &&
        slotToColumn[end] !== undefined &&
        sameCell(
          cell,
          scheduleData.cells[currentMember.id][end]
        )
      ) {
        end++;
      }

      const bar = el(
        "div",
        cell.type === "break" ? "break-bar" : "bar"
      );

      bar.style.gridColumn =
        `${slotToColumn[slot] + 2} / ` +
        `${slotToColumn[end - 1] + 3}`;

      const barName = cell.type === "break"
        ? (cell.breakKind ? "休憩" : "稼働外")
        : cell.task.name;

      if (cell.type === "break" && !cell.breakKind) {
        bar.classList.add("unavailable-bar");
      } else {
        const text = el("span", "bar-label");

        text.textContent = barName;
        bar.append(text);
        bar.dataset.fullLabel = barName;

        if (cell.type === "break") {
          bar.dataset.breakLabel = "true";
        } else {
          bar.style.setProperty(
            "--bar-color",
            cell.task.color
          );
        }

        // カーソルを合わせると内容を表示
        bar.title =
          `${barName}\n` +
          `担当：${currentMember.name}\n` +
          `${clock(workStart + slot * STEP)} ～ ` +
          `${clock(workStart + end * STEP)}`;

        bar.tabIndex = 0;
        bar.setAttribute("aria-label", bar.title);
      }

      row.append(bar);
      slot = end;
    }

    schedule.append(row);
  });

  resultArea.append(schedule);
  requestAnimationFrame(fitScheduleLabels);

  if (scheduleData.failed.length) {
    const unplaced = el("section", "unplaced");

    const items = scheduleData.failed
      .map((failedItem) =>
        "<li><strong>" +
        escapeHtml(failedItem.task.name) +
        "</strong>：" +
        escapeHtml(failedItem.reason) +
        "</li>"
      )
      .join("");

    unplaced.innerHTML =
      "<h3>配置できなかった作業</h3><ul>" +
      items +
      "</ul>";

    resultArea.append(unplaced);
  }
}

function sameCell(firstCell, secondCell) {
  if (
    !firstCell ||
    !secondCell ||
    firstCell.type !== secondCell.type
  ) {
    return false;
  }

  if (firstCell.type === "break") {
    return firstCell.breakKind === secondCell.breakKind;
  }

  return firstCell.task.id === secondCell.task.id;
}

function parseDateTime(value) {
  const match = String(value || "")
    .trim()
    .match(
      /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}):(\d{2})$/
    );

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hours = Number(match[4]);
  const minutes = Number(match[5]);

  const date = new Date(
    year,
    month - 1,
    day,
    hours,
    minutes
  );

  const isValid =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getHours() === hours &&
    date.getMinutes() === minutes;

  return isValid ? date : null;
}

function toMin(value) {
  const date = parseDateTime(value);

  return date
    ? Math.floor(date.getTime() / 60000)
    : null;
}

function clock(minutes) {
  const date = new Date(minutes * 60000);

  if (isDayMode()) {
    return (
      String(date.getMonth() + 1).padStart(2, "0") +
      "/" +
      String(date.getDate()).padStart(2, "0")
    );
  }

  return (
    String(date.getMonth() + 1).padStart(2, "0") +
    "/" +
    String(date.getDate()).padStart(2, "0") +
    "\n" +
    String(date.getHours()).padStart(2, "0") +
    ":" +
    String(date.getMinutes()).padStart(2, "0")
  );
}

function localDateTime(date) {
  return (
    date.getFullYear() +
    "-" +
    String(date.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getDate()).padStart(2, "0") +
    " " +
    String(date.getHours()).padStart(2, "0") +
    ":" +
    String(date.getMinutes()).padStart(2, "0")
  );
}

function setDefaultDateTimes() {
  const now = new Date();

  const defaultStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    7,
    0
  );

  const defaultEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    20,
    0
  );

  startEl.value = localDateTime(defaultStart);
  endEl.value = localDateTime(defaultEnd);
}

function dateTimeOnWorkDate(timeValue) {
  const workDate = parseDateTime(startEl.value) || new Date();

  const [hours, minutes] = timeValue
    .split(":")
    .map(Number);

  return localDateTime(
    new Date(
      workDate.getFullYear(),
      workDate.getMonth(),
      workDate.getDate(),
      hours,
      minutes
    )
  );
}

function normalizeDateTime(value) {
  if (/^\d{2}:\d{2}$/.test(value || "")) {
    return dateTimeOnWorkDate(value);
  }

  const date = parseDateTime(value);

  return date
    ? localDateTime(date)
    : String(value || "").trim();
}

function escapeHtml(value) {
  const element = document.createElement("div");
  element.textContent = String(value);

  return element.innerHTML;
}

function toast(message) {
  const toastElement = $("toast");

  toastElement.textContent = message;
  toastElement.classList.add("show");

  clearTimeout(toast.timer);

  toast.timer = setTimeout(() => {
    toastElement.classList.remove("show");
  }, 2600);
}

function save() {
  localStorage.setItem(
    STORE,
    JSON.stringify({
      start: startEl.value,
      end: endEl.value,
      baseAvailability,
      scheduleStep,
      members,
      tasks
    })
  );
}

function load() {
  try {
    const savedData = JSON.parse(localStorage.getItem(STORE));

    if (!savedData) return;

    if (savedData.start) {
      startEl.value = normalizeDateTime(savedData.start);
    }

    if (savedData.end) {
      endEl.value = normalizeDateTime(savedData.end);
    }

    if (
      savedData.scheduleStep &&
      ["minute", "hour", "day"].includes(
        savedData.scheduleStep.unit
      )
    ) {
      scheduleStep = {
        value: Math.max(
          1,
          Math.round(
            Number(savedData.scheduleStep.value) || 1
          )
        ),
        unit: savedData.scheduleStep.unit
      };

      STEP = stepToMinutes(scheduleStep);
    }

    if (
      savedData.baseAvailability &&
      timeOnlyToMinutes(savedData.baseAvailability.start) !== null &&
      timeOnlyToMinutes(savedData.baseAvailability.end) !== null &&
      timeOnlyToMinutes(savedData.baseAvailability.end) >
        timeOnlyToMinutes(savedData.baseAvailability.start)
    ) {
      baseAvailability = {
        start: savedData.baseAvailability.start,
        end: savedData.baseAvailability.end
      };
    }

    if (Array.isArray(savedData.members)) {
      members = savedData.members.map((savedMember) => {
        const availability = Array.isArray(savedMember.availability)
          ? savedMember.availability
          : null;

        const oldBreaks = Array.isArray(savedMember.breaks)
          ? savedMember.breaks
          : [];

        return {
          ...member(),
          ...savedMember,

          availability: (
            availability !== null
              ? availability
              : availabilityFromBreaks(oldBreaks)
          ).map((item) => ({
            ...item,
            start: normalizeDateTime(item.start),
            end: normalizeDateTime(item.end)
          })),

          restRules: (
            Array.isArray(savedMember.restRules)
              ? savedMember.restRules
              : []
          ).map((restRule) => ({
            id: restRule.id || id(),
            type:
              restRule.type === "fixed"
                ? "fixed"
                : "flexible",
            minutes: Math.max(
              15,
              Number(restRule.minutes) || 60
            ),
            start: normalizeDateTime(
              restRule.start || dateTimeOnWorkDate("12:00")
            ),
            end: normalizeDateTime(
              restRule.end || dateTimeOnWorkDate("13:00")
            )
          })),

          breaks: undefined
        };
      });
    }

    if (Array.isArray(savedData.tasks)) {
      tasks = savedData.tasks.map((savedTask, index) => ({
        ...task(),
        ...savedTask,
        start: normalizeDateTime(savedTask.start),
        color: savedTask.color || COLORS[index % COLORS.length]
      }));
    }
  } catch (error) {
    console.warn("保存データを読み込めませんでした", error);
  }
}

function availabilityFromBreaks(breaks) {
  const workStart = toMin(startEl.value);
  const workEnd = toMin(endEl.value);

  if (
    workStart === null ||
    workEnd === null ||
    workEnd <= workStart
  ) {
    return [];
  }

  const normalizedBreaks = breaks
    .map((currentBreak) => ({
      start: toMin(normalizeDateTime(currentBreak.start)),
      end: toMin(normalizeDateTime(currentBreak.end))
    }))
    .filter(
      (currentBreak) =>
        currentBreak.start !== null &&
        currentBreak.end !== null &&
        currentBreak.end > currentBreak.start &&
        currentBreak.end > workStart &&
        currentBreak.start < workEnd
    )
    .map((currentBreak) => ({
      start: Math.max(workStart, currentBreak.start),
      end: Math.min(workEnd, currentBreak.end)
    }))
    .sort(
      (firstBreak, secondBreak) =>
        firstBreak.start - secondBreak.start
    );

  const mergedBreaks = [];

  normalizedBreaks.forEach((currentBreak) => {
    const previousBreak = mergedBreaks.at(-1);

    if (
      previousBreak &&
      currentBreak.start <= previousBreak.end
    ) {
      previousBreak.end = Math.max(
        previousBreak.end,
        currentBreak.end
      );
    } else {
      mergedBreaks.push({ ...currentBreak });
    }
  });

  const availability = [];
  let currentStart = workStart;

  mergedBreaks.forEach((currentBreak) => {
    if (currentBreak.start > currentStart) {
      availability.push({
        id: id(),
        start: localDateTime(
          new Date(currentStart * 60000)
        ),
        end: localDateTime(
          new Date(currentBreak.start * 60000)
        )
      });
    }

    currentStart = Math.max(currentStart, currentBreak.end);
  });

  if (currentStart < workEnd) {
    availability.push({
      id: id(),
      start: localDateTime(
        new Date(currentStart * 60000)
      ),
      end: localDateTime(
        new Date(workEnd * 60000)
      )
    });
  }

  return availability;
}

/* 狭い休憩バーでは「休」に短縮 */
function fitScheduleLabels() {
  resultArea
    .querySelectorAll("[data-break-label]")
    .forEach((bar) => {
      const labelElement = bar.querySelector(".bar-label");

      labelElement.textContent = "休憩";

      if (labelElement.scrollWidth > bar.clientWidth - 10) {
        labelElement.textContent = "休";
      }
    });
}

/* 横軸の幅を調整 */
const axisZoom = $("axisZoom");

axisZoom.addEventListener("input", () => {
  $("axisZoomValue").textContent = `${axisZoom.value}px`;

  const schedule = resultArea.querySelector(".schedule");

  if (schedule) {
    const flags = schedule.style
      .getPropertyValue("--print-tracks")
      .match(/14px|minmax\(0, 1fr\)/g) || [];

    schedule.style.setProperty(
      "--axis-tracks",
      flags
        .map((flag) =>
          flag === "14px"
            ? "28px"
            : `${axisZoom.value}px`
        )
        .join(" ")
    );

    fitScheduleLabels();
  }
});

const scheduleLabelObserver =
  new ResizeObserver(fitScheduleLabels);

scheduleLabelObserver.observe(resultArea);