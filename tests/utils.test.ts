import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  normalizePathPure,
  getParentPath,
  isTopLevelProjectFolder,
  getFolderName,
  generateArchiveDestination,
} from "../src/utils";

describe("normalizePathPure", () => {
  it("trims leading slashes", () => {
    expect(normalizePathPure("/Projects")).toBe("Projects");
    expect(normalizePathPure("///Projects")).toBe("Projects");
  });

  it("trims trailing slashes", () => {
    expect(normalizePathPure("Projects/")).toBe("Projects");
    expect(normalizePathPure("Projects///")).toBe("Projects");
  });

  it("trims both leading and trailing slashes", () => {
    expect(normalizePathPure("/Projects/")).toBe("Projects");
    expect(normalizePathPure("///Projects///")).toBe("Projects");
  });

  it("collapses multiple slashes in the middle", () => {
    expect(normalizePathPure("Projects//MyProject")).toBe("Projects/MyProject");
    expect(normalizePathPure("Projects///MyProject///Sub")).toBe(
      "Projects/MyProject/Sub"
    );
  });

  it("converts backslashes to forward slashes", () => {
    expect(normalizePathPure("Projects\\MyProject")).toBe("Projects/MyProject");
    expect(normalizePathPure("Projects\\\\MyProject")).toBe(
      "Projects/MyProject"
    );
  });

  it("handles empty string", () => {
    expect(normalizePathPure("")).toBe("");
  });

  it("handles single folder name", () => {
    expect(normalizePathPure("Projects")).toBe("Projects");
  });
});

describe("getParentPath", () => {
  it("returns empty string for root-level paths", () => {
    expect(getParentPath("Projects")).toBe("");
    expect(getParentPath("/Projects/")).toBe("");
  });

  it("returns parent for nested paths", () => {
    expect(getParentPath("Projects/MyProject")).toBe("Projects");
    expect(getParentPath("Archive/OldProject")).toBe("Archive");
  });

  it("returns parent for deeply nested paths", () => {
    expect(getParentPath("Projects/MyProject/SubFolder")).toBe(
      "Projects/MyProject"
    );
  });

  it("handles paths with extra slashes", () => {
    expect(getParentPath("/Projects/MyProject/")).toBe("Projects");
  });
});

describe("isTopLevelProjectFolder", () => {
  it("returns true for direct children of projectsPath", () => {
    expect(isTopLevelProjectFolder("Projects/MyProject", "Projects")).toBe(
      true
    );
    expect(isTopLevelProjectFolder("Work/ClientA", "Work")).toBe(true);
  });

  it("returns false for nested folders", () => {
    expect(
      isTopLevelProjectFolder("Projects/MyProject/SubFolder", "Projects")
    ).toBe(false);
    expect(isTopLevelProjectFolder("Projects/A/B/C", "Projects")).toBe(false);
  });

  it("returns false for the projects folder itself", () => {
    expect(isTopLevelProjectFolder("Projects", "Projects")).toBe(false);
  });

  it("returns false for unrelated folders", () => {
    expect(isTopLevelProjectFolder("Archive/OldProject", "Projects")).toBe(
      false
    );
    expect(isTopLevelProjectFolder("RandomFolder", "Projects")).toBe(false);
  });

  it("handles paths with various normalizations", () => {
    expect(isTopLevelProjectFolder("/Projects/MyProject/", "/Projects/")).toBe(
      true
    );
    expect(isTopLevelProjectFolder("Projects//MyProject", "Projects")).toBe(
      true
    );
  });

  it("returns false when parent is substring but not actual parent", () => {
    expect(isTopLevelProjectFolder("ProjectsExtra/MyProject", "Projects")).toBe(
      false
    );
  });
});

describe("getFolderName", () => {
  it("returns folder name from path", () => {
    expect(getFolderName("Projects/MyProject")).toBe("MyProject");
    expect(getFolderName("Archive/OldStuff")).toBe("OldStuff");
  });

  it("returns the path itself for root-level folders", () => {
    expect(getFolderName("Projects")).toBe("Projects");
  });

  it("handles paths with trailing slashes", () => {
    expect(getFolderName("Projects/MyProject/")).toBe("MyProject");
  });

  it("handles deeply nested paths", () => {
    expect(getFolderName("A/B/C/D/E")).toBe("E");
  });
});

describe("generateArchiveDestination", () => {
  beforeEach(() => {
    // Mock Date to return a fixed date
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-03-15T12:00:00Z"));
  });

  it("returns base destination when no collision", () => {
    const existingPaths = new Set<string>();
    const result = generateArchiveDestination(
      "Archive",
      "MyProject",
      existingPaths
    );
    expect(result).toBe("Archive/MyProject");
  });

  it("adds date suffix when base destination exists", () => {
    const existingPaths = new Set(["Archive/MyProject"]);
    const result = generateArchiveDestination(
      "Archive",
      "MyProject",
      existingPaths
    );
    expect(result).toBe("Archive/MyProject (Archived 2024-03-15)");
  });

  it("adds counter when date-suffixed destination exists", () => {
    const existingPaths = new Set([
      "Archive/MyProject",
      "Archive/MyProject (Archived 2024-03-15)",
    ]);
    const result = generateArchiveDestination(
      "Archive",
      "MyProject",
      existingPaths
    );
    expect(result).toBe("Archive/MyProject (Archived 2024-03-15) (2)");
  });

  it("increments counter for multiple collisions", () => {
    const existingPaths = new Set([
      "Archive/MyProject",
      "Archive/MyProject (Archived 2024-03-15)",
      "Archive/MyProject (Archived 2024-03-15) (2)",
      "Archive/MyProject (Archived 2024-03-15) (3)",
    ]);
    const result = generateArchiveDestination(
      "Archive",
      "MyProject",
      existingPaths
    );
    expect(result).toBe("Archive/MyProject (Archived 2024-03-15) (4)");
  });

  it("normalizes archive path", () => {
    const existingPaths = new Set<string>();
    const result = generateArchiveDestination(
      "/Archive/",
      "MyProject",
      existingPaths
    );
    expect(result).toBe("Archive/MyProject");
  });

  it("handles nested archive paths", () => {
    const existingPaths = new Set<string>();
    const result = generateArchiveDestination(
      "Storage/Archive",
      "MyProject",
      existingPaths
    );
    expect(result).toBe("Storage/Archive/MyProject");
  });
});
