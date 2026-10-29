import { describe, expect, it } from "vitest";
import { parseCsv, parseResourcesCsv, parseServicesCsv } from "@/lib/onboarding/csv";

describe("parseCsv", () => {
  it("handles quotes, commas inside quotes, CRLF and blank lines", () => {
    const rows = parseCsv('name,notes\r\n"Table, A","say ""hi"""\r\n\r\nB,plain\r\n');
    expect(rows).toEqual([["name", "notes"], ["Table, A", 'say "hi"'], ["B", "plain"]]);
  });
});

describe("parseResourcesCsv", () => {
  it("parses valid rows regardless of header case", () => {
    const result = parseResourcesCsv("Name,Type,Capacity\nTable 1,table,4\nPriya,staff,1");
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      { name: "Table 1", type: "table", capacity: 4 },
      { name: "Priya", type: "staff", capacity: 1 },
    ]);
  });

  it("reports line numbers for bad rows and missing headers", () => {
    const result = parseResourcesCsv("name,type,capacity\nA,sofa,2\nB,table,0\nC,table,3");
    expect(result.rows).toHaveLength(1);
    expect(result.errors.map((error) => error.slice(0, 7))).toEqual(["Line 2:", "Line 3:"]);
    expect(parseResourcesCsv("name,capacity\nA,2").errors[0]).toContain("header");
    expect(parseResourcesCsv("").errors[0]).toContain("empty");
  });
});

describe("parseServicesCsv", () => {
  it("converts price to cents and applies the chosen resource type", () => {
    const result = parseServicesCsv("name,duration,price,buffer\nHaircut,45,500,5\nConsult,20,,", "staff");
    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({ name: "Haircut", durationMin: 45, priceCents: 50000, bufferAfterMin: 5 });
    expect(result.rows[0]?.requirements).toEqual([{ resourceType: "staff", quantity: 1 }]);
    expect(result.rows[1]).toMatchObject({ priceCents: null, bufferAfterMin: 0 });
  });

  it("reports bad durations and prices", () => {
    const result = parseServicesCsv("name,duration,price\nA,abc,10\nB,30,xyz\nC,30,10", "staff");
    expect(result.rows).toHaveLength(1);
    expect(result.errors).toHaveLength(2);
  });
});
