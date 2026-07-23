export function createAuthRuntimeState(overrides = {}) {
  return {
    status: "loading",
    user: null,
    profile: null,
    client: null,
    error: "",
    loading: false,
    ...overrides,
  };
}

export function createWorkDayRuntimeState(overrides = {}) {
  return {
    status: "idle",
    saveStatus: "ready",
    historyStatus: "ready",
    period: null,
    workDay: null,
    workDate: null,
    lastSavedAt: null,
    message: "",
    ...overrides,
  };
}

export function createHistoryRuntimeState(overrides = {}) {
  return {
    status: "idle",
    snapshots: [],
    selectedSnapshot: null,
    filters: {
      date: "",
      pen: "",
      lot: "",
      diet: "",
    },
    message: "",
    ...overrides,
  };
}
