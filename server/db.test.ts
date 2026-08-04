import { describe, it, expect, vi, beforeEach } from "vitest";
import { getFluids, getPipeMaterials, getCalculations } from "./db";

// Mock the database connection
vi.mock("./db", async () => {
  const actual = await vi.importActual("./db");
  return {
    ...actual,
    getDb: vi.fn(async () => null),
  };
});

describe("Database Helpers", () => {
  describe("getFluids", () => {
    it("should return empty array when database is not available", async () => {
      const result = await getFluids(1);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it("should handle null userId", async () => {
      const result = await getFluids(null);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("getPipeMaterials", () => {
    it("should return empty array when database is not available", async () => {
      const result = await getPipeMaterials(1);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it("should handle null userId", async () => {
      const result = await getPipeMaterials(null);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("getCalculations", () => {
    it("should return empty array when database is not available", async () => {
      const result = await getCalculations(1);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });
});
