const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseIsoDate(value) {
  if (!ISO_DATE_PATTERN.test(String(value ?? ""))) {
    throw new Error("La fecha de trabajo debe usar el formato YYYY-MM-DD.");
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const isExactDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  if (!isExactDate) {
    throw new Error("La fecha de trabajo no es válida.");
  }

  return date;
}

export function nextIsoDate(workDate) {
  const date = parseIsoDate(workDate);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function buildNextWorkDayState(currentState) {
  const currentDate = currentState?.config?.workDate;
  const workDate = nextIsoDate(currentDate);
  const source = clone(currentState ?? {});

  return {
    ...source,
    config: {
      ...(source.config ?? {}),
      workDate,
    },
    consumptionNotes: {},
    feedingActuals: {},
    treatmentIngredientActuals: {},
    reportOverrides: {},
  };
}
