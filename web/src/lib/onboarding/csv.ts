import { z } from "zod";
import { resourceTypeSchema, serviceWriteSchema, type ServiceWriteInput, type StoreResource } from "@/lib/validation";

export type CsvResourceRow = { name: string; type: StoreResource["type"]; capacity: number };

export type CsvParseResult<T> = { rows: T[]; errors: string[] };

/** Minimal RFC 4180 reader: quoted fields, escaped quotes, CRLF, and blank lines. */
export const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");

  const endField = () => {
    row.push(field.trim());
    field = "";
  };
  const endRow = () => {
    endField();
    if (row.some((value) => value.length > 0)) {
      rows.push(row);
    }
    row = [];
  };

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      endField();
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") {
        index += 1;
      }
      endRow();
    } else {
      field += char;
    }
  }
  endRow();
  return rows;
};

const normalise = (header: string) => header.toLowerCase().replace(/[^a-z]+/g, "_").replace(/^_+|_+$/g, "");

const columnIndex = (header: string[], names: string[]): number =>
  header.map(normalise).findIndex((value) => names.includes(value));

const cell = (row: string[], index: number): string => (index >= 0 ? (row[index] ?? "") : "");

const resourceRowSchema = z.object({
  name: z.string().min(1, "name is required"),
  type: resourceTypeSchema,
  capacity: z.number().int().min(1, "capacity must be a whole number of at least 1"),
});

export const parseResourcesCsv = (text: string): CsvParseResult<CsvResourceRow> => {
  const table = parseCsv(text);
  const header = table[0];
  if (!header) {
    return { rows: [], errors: ["The file is empty."] };
  }
  const nameAt = columnIndex(header, ["name"]);
  const typeAt = columnIndex(header, ["type"]);
  const capacityAt = columnIndex(header, ["capacity", "seats"]);
  if (nameAt < 0 || typeAt < 0 || capacityAt < 0) {
    return { rows: [], errors: ["The header row must contain name, type and capacity."] };
  }

  const rows: CsvResourceRow[] = [];
  const errors: string[] = [];
  table.slice(1).forEach((row, offset) => {
    const parsed = resourceRowSchema.safeParse({
      name: cell(row, nameAt),
      type: cell(row, typeAt).toLowerCase(),
      capacity: Number(cell(row, capacityAt)),
    });
    if (parsed.success) {
      rows.push(parsed.data);
    } else {
      errors.push(`Line ${offset + 2}: ${parsed.error.issues[0]?.message ?? "invalid row"}`);
    }
  });
  return { rows, errors };
};

const numberOrNaN = (value: string, fallback: number): number => (value === "" ? fallback : Number(value));

export const parseServicesCsv = (
  text: string,
  resourceType: StoreResource["type"],
): CsvParseResult<ServiceWriteInput> => {
  const table = parseCsv(text);
  const header = table[0];
  if (!header) {
    return { rows: [], errors: ["The file is empty."] };
  }
  const nameAt = columnIndex(header, ["name", "service"]);
  const durationAt = columnIndex(header, ["duration", "duration_min", "minutes"]);
  const priceAt = columnIndex(header, ["price", "price_rs", "rupees"]);
  const bufferAt = columnIndex(header, ["buffer", "buffer_min", "buffer_after"]);
  const minPartyAt = columnIndex(header, ["min_party"]);
  const maxPartyAt = columnIndex(header, ["max_party"]);
  if (nameAt < 0 || durationAt < 0) {
    return { rows: [], errors: ["The header row must contain name and duration."] };
  }

  const rows: ServiceWriteInput[] = [];
  const errors: string[] = [];
  table.slice(1).forEach((row, offset) => {
    const price = cell(row, priceAt);
    const priceValue = price === "" ? null : Number(price);
    if (priceValue !== null && (!Number.isFinite(priceValue) || priceValue < 0)) {
      errors.push(`Line ${offset + 2}: price must be a number in rupees or blank`);
      return;
    }
    const minParty = numberOrNaN(cell(row, minPartyAt), 1);
    const maxParty = numberOrNaN(cell(row, maxPartyAt), minParty);
    const candidate = {
      name: cell(row, nameAt),
      durationMin: Number(cell(row, durationAt)),
      bufferAfterMin: numberOrNaN(cell(row, bufferAt), 0),
      priceCents: priceValue === null ? null : Math.round(priceValue * 100),
      minParty,
      maxParty,
      requirements: [{ resourceType, quantity: 1 }],
    };
    const parsed = serviceWriteSchema.safeParse(candidate);
    if (parsed.success) {
      rows.push(parsed.data);
    } else {
      errors.push(`Line ${offset + 2}: ${parsed.error.issues[0]?.message ?? "invalid row"}`);
    }
  });
  return { rows, errors };
};
