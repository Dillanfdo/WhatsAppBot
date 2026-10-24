export type MinuteWindow = {
  startMin: number;
  endMin: number;
};

export type Requirement = {
  resourceType: string;
  quantity: number;
};

export type ResourceCandidate = {
  id: string;
  type: string;
  name: string;
  capacity: number;
};

export type BusyInterval = {
  resourceId: string;
  startMs: number;
  endMs: number;
};

const byStart = (left: MinuteWindow, right: MinuteWindow) => left.startMin - right.startMin;

export const mergeWindows = (windows: MinuteWindow[]): MinuteWindow[] => {
  const sorted = windows
    .filter((window) => window.endMin > window.startMin)
    .sort(byStart);
  const merged: MinuteWindow[] = [];
  for (const window of sorted) {
    const previous = merged.at(-1);
    if (!previous || window.startMin > previous.endMin) {
      merged.push({ ...window });
      continue;
    }
    previous.endMin = Math.max(previous.endMin, window.endMin);
  }
  return merged;
};

export const subtractWindows = (open: MinuteWindow[], closed: MinuteWindow[]): MinuteWindow[] => {
  let current = mergeWindows(open);
  for (const block of mergeWindows(closed)) {
    const next: MinuteWindow[] = [];
    for (const window of current) {
      if (block.endMin <= window.startMin || block.startMin >= window.endMin) {
        next.push(window);
        continue;
      }
      if (block.startMin > window.startMin) {
        next.push({ startMin: window.startMin, endMin: block.startMin });
      }
      if (block.endMin < window.endMin) {
        next.push({ startMin: block.endMin, endMin: window.endMin });
      }
    }
    current = next;
  }
  return current;
};

export const addWindows = (open: MinuteWindow[], extra: MinuteWindow[]): MinuteWindow[] =>
  mergeWindows([...open, ...extra]);

export const minutesFromClock = (value: string): number => {
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw new Error(`Expected a clock time, received "${value}"`);
  }
  return hour * 60 + minute;
};

export const generateGrid = (intervalMin: number): number[] => {
  if (!Number.isInteger(intervalMin) || intervalMin <= 0) {
    throw new Error("slot interval must be a positive number of minutes");
  }
  const starts: number[] = [];
  for (let minute = 0; minute < 24 * 60; minute += intervalMin) {
    starts.push(minute);
  }
  return starts;
};

export const fitsInWindow = (
  windows: readonly MinuteWindow[],
  startMin: number,
  durationMin: number,
): boolean => windows.some((window) => startMin >= window.startMin && startMin + durationMin <= window.endMin);

export const intervalsOverlap = (
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean => aStart < bEnd && bStart < aEnd;

export const resourceIsFree = (
  busy: readonly BusyInterval[],
  resourceId: string,
  startMs: number,
  endMs: number,
): boolean =>
  !busy.some(
    (interval) =>
      interval.resourceId === resourceId &&
      intervalsOverlap(startMs, endMs, interval.startMs, interval.endMs),
  );

const byCapacityThenId = (left: ResourceCandidate, right: ResourceCandidate) =>
  left.capacity - right.capacity || left.id.localeCompare(right.id);

const choose = (pool: ResourceCandidate[], quantity: number): ResourceCandidate[][] => {
  const picks: ResourceCandidate[][] = [];
  const walk = (start: number, chosen: ResourceCandidate[]) => {
    if (chosen.length === quantity) {
      picks.push([...chosen]);
      return;
    }
    for (let index = start; index < pool.length; index += 1) {
      const candidate = pool[index];
      if (!candidate) {
        continue;
      }
      chosen.push(candidate);
      walk(index + 1, chosen);
      chosen.pop();
    }
  };
  walk(0, []);
  return picks;
};

/** Smallest fitting resources first. Stops after `limit` full assignments. */
export const assignmentCombinations = (
  freeByType: ReadonlyMap<string, ResourceCandidate[]>,
  requirements: readonly Requirement[],
  limit = 10,
): ResourceCandidate[][] => {
  const pools = requirements.map((requirement) =>
    [...(freeByType.get(requirement.resourceType) ?? [])].sort(byCapacityThenId),
  );
  const results: ResourceCandidate[][] = [];
  const walk = (index: number, chosen: ResourceCandidate[]) => {
    if (results.length >= limit) {
      return;
    }
    if (index === requirements.length) {
      results.push([...chosen]);
      return;
    }
    const requirement = requirements[index];
    const pool = pools[index];
    if (!requirement || !pool) {
      return;
    }
    for (const pick of choose(pool, requirement.quantity)) {
      if (pick.some((resource) => chosen.some((existing) => existing.id === resource.id))) {
        continue;
      }
      chosen.push(...pick);
      walk(index + 1, chosen);
      chosen.splice(chosen.length - pick.length, pick.length);
      if (results.length >= limit) {
        return;
      }
    }
  };
  walk(0, []);
  return results;
};

export const freeByTypeAt = (
  resources: readonly ResourceCandidate[],
  busy: readonly BusyInterval[],
  windows: ReadonlyMap<string, MinuteWindow[]>,
  startMin: number,
  durationMin: number,
  startMs: number,
  blockEndMs: number,
): Map<string, ResourceCandidate[]> => {
  const grouped = new Map<string, ResourceCandidate[]>();
  for (const resource of resources) {
    const open = windows.get(resource.id) ?? [];
    if (!fitsInWindow(open, startMin, durationMin)) {
      continue;
    }
    if (!resourceIsFree(busy, resource.id, startMs, blockEndMs)) {
      continue;
    }
    const list = grouped.get(resource.type) ?? [];
    list.push(resource);
    grouped.set(resource.type, list);
  }
  return grouped;
};

export const requirementsMet = (
  freeByType: ReadonlyMap<string, ResourceCandidate[]>,
  requirements: readonly Requirement[],
): boolean =>
  requirements.every(
    (requirement) => (freeByType.get(requirement.resourceType)?.length ?? 0) >= requirement.quantity,
  );
