import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  normalizePathPure,
  getParentPath,
  isTopLevelProjectFolder,
  getItemName,
  generateArchiveDestination,
  isNestedPath,
  arePathsNested,
  validateParaFolderPath,
  compareByLastModified,
  extractDateFormatFromProjectFormat,
  type ParaSettings,
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

describe("getItemName", () => {
  it("returns folder name from path", () => {
    expect(getItemName("Projects/MyProject")).toBe("MyProject");
    expect(getItemName("Archive/OldStuff")).toBe("OldStuff");
  });

  it("returns the path itself for root-level folders", () => {
    expect(getItemName("Projects")).toBe("Projects");
  });

  it("handles paths with trailing slashes", () => {
    expect(getItemName("Projects/MyProject/")).toBe("MyProject");
  });

  it("handles deeply nested paths", () => {
    expect(getItemName("A/B/C/D/E")).toBe("E");
  });
});

describe("generateArchiveDestination", () => {
  const TEST_DATE = "2024-03-15";

  beforeEach(() => {
    // Mock Date to return a fixed date
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${TEST_DATE}T12:00:00Z`));
  });

  afterEach(() => {
    vi.useRealTimers();
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
    expect(result).toBe(`Archive/MyProject (Archived ${TEST_DATE})`);
  });

  it("adds counter when date-suffixed destination exists", () => {
    const existingPaths = new Set([
      "Archive/MyProject",
      `Archive/MyProject (Archived ${TEST_DATE})`,
    ]);
    const result = generateArchiveDestination(
      "Archive",
      "MyProject",
      existingPaths
    );
    expect(result).toBe(`Archive/MyProject (Archived ${TEST_DATE}) (2)`);
  });

  it("increments counter for multiple collisions", () => {
    const existingPaths = new Set([
      "Archive/MyProject",
      `Archive/MyProject (Archived ${TEST_DATE})`,
      `Archive/MyProject (Archived ${TEST_DATE}) (2)`,
      `Archive/MyProject (Archived ${TEST_DATE}) (3)`,
    ]);
    const result = generateArchiveDestination(
      "Archive",
      "MyProject",
      existingPaths
    );
    expect(result).toBe(`Archive/MyProject (Archived ${TEST_DATE}) (4)`);
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

  it("throws error when too many collisions exist", () => {
    // Create a Set-like object that always reports collision
    const alwaysCollides = {
      has: () => true,
    } as Set<string>;

    expect(() =>
      generateArchiveDestination("Archive", "MyProject", alwaysCollides)
    ).toThrow("Too many archive collisions");
  });
});

describe("isNestedPath", () => {
  it("returns true when path1 is parent of path2", () => {
    expect(isNestedPath("Work", "Work/Projects")).toBe(true);
    expect(isNestedPath("Projects", "Projects/MyProject")).toBe(true);
  });

  it("returns true when path2 is parent of path1", () => {
    expect(isNestedPath("Work/Projects", "Work")).toBe(true);
    expect(isNestedPath("Projects/Archive", "Projects")).toBe(true);
  });

  it("returns true when paths are identical", () => {
    expect(isNestedPath("Projects", "Projects")).toBe(true);
    expect(isNestedPath("Work/Projects", "Work/Projects")).toBe(true);
  });

  it("returns true for deeply nested paths", () => {
    expect(isNestedPath("A/B", "A/B/C/D")).toBe(true);
    expect(isNestedPath("A/B/C/D", "A/B")).toBe(true);
  });

  it("returns false when paths are unrelated", () => {
    expect(isNestedPath("Projects", "Archive")).toBe(false);
    expect(isNestedPath("Areas", "Resources")).toBe(false);
  });

  it("returns false when paths share a prefix but aren't nested", () => {
    expect(isNestedPath("ProjectsExtra", "Projects")).toBe(false);
    expect(isNestedPath("Projects", "ProjectsExtra")).toBe(false);
  });

  it("handles paths with various normalizations", () => {
    expect(isNestedPath("/Work/", "Work/Projects")).toBe(true);
    expect(isNestedPath("Work", "/Work/Projects/")).toBe(true);
    expect(isNestedPath("/Work///", "///Work/Projects///")).toBe(true);
  });

  it("handles backslashes", () => {
    expect(isNestedPath("Work\\Projects", "Work")).toBe(true);
    expect(isNestedPath("Work", "Work\\Projects")).toBe(true);
  });
});

describe("arePathsNested", () => {
  it("returns null when all paths are non-nested", () => {
    expect(arePathsNested(["Projects", "Areas", "Resources", "Archive"])).toBe(
      null
    );
  });

  it("returns error message when any two paths are nested", () => {
    const result = arePathsNested(["Projects", "Projects/Archive", "Areas"]);
    expect(result).toBeTruthy();
    expect(result).toContain("cannot be nested");
    expect(result).toContain("Projects");
  });

  it("detects nesting in various positions", () => {
    expect(arePathsNested(["Work", "Work/Projects", "Archive"])).toBeTruthy();
    expect(arePathsNested(["Projects", "Areas", "Areas/SubArea"])).toBeTruthy();
  });

  it("handles identical paths", () => {
    const result = arePathsNested(["Projects", "Projects"]);
    expect(result).toBeTruthy();
  });

  it("handles empty array", () => {
    expect(arePathsNested([])).toBe(null);
  });

  it("handles single path", () => {
    expect(arePathsNested(["Projects"])).toBe(null);
  });

  it("handles normalized and unnormalized paths", () => {
    const result = arePathsNested(["/Projects/", "Projects"]);
    expect(result).toBeTruthy(); // Same path with different formatting
  });
});

describe("validateParaFolderPath", () => {
  let defaultSettings: ParaSettings;

  beforeEach(() => {
    defaultSettings = {
      projectsPath: "Projects",
      areasPath: "Areas",
      resourcesPath: "Resources",
      archivePath: "Archive",
    };
  });

  it("returns null for valid non-overlapping paths", () => {
    const result = validateParaFolderPath("Work", "projectsPath", defaultSettings);
    expect(result).toBeNull();
  });

  it("returns null when changing a field to a different non-overlapping path", () => {
    const result = validateParaFolderPath("NewProjects", "projectsPath", defaultSettings);
    expect(result).toBeNull();
  });

  it("returns error when paths are equal (projectsPath)", () => {
    const result = validateParaFolderPath("Areas", "projectsPath", defaultSettings);
    expect(result).not.toBeNull();
    expect(result).toContain("Projects folder cannot be the same as Areas folder");
  });

  it("returns error when paths are equal (areasPath)", () => {
    const result = validateParaFolderPath("Resources", "areasPath", defaultSettings);
    expect(result).not.toBeNull();
    expect(result).toContain("Areas folder cannot be the same as Resources folder");
  });

  it("returns error when paths are equal (resourcesPath)", () => {
    const result = validateParaFolderPath("Archive", "resourcesPath", defaultSettings);
    expect(result).not.toBeNull();
    expect(result).toContain("Resources folder cannot be the same as Archive folder");
  });

  it("returns error when paths are equal (archivePath)", () => {
    const result = validateParaFolderPath("Projects", "archivePath", defaultSettings);
    expect(result).not.toBeNull();
    expect(result).toContain("Archive folder cannot be the same as Projects folder");
  });

  it("returns error when new path is nested inside another path", () => {
    const result = validateParaFolderPath("Projects/SubFolder", "areasPath", defaultSettings);
    expect(result).not.toBeNull();
    expect(result).toContain("Areas folder cannot be nested with Projects folder");
  });

  it("returns error when new path is parent of another path", () => {
    // When trying to set areasPath to "Areas" while projectsPath is "Areas/Projects"
    defaultSettings.projectsPath = "Areas/Projects";
    const result = validateParaFolderPath("Areas", "areasPath", defaultSettings);
    expect(result).not.toBeNull();
    expect(result).toContain("Areas folder cannot be nested with Projects folder");
  });

  it("error message includes both folder names", () => {
    const result = validateParaFolderPath("Projects/Nested", "areasPath", defaultSettings);
    expect(result).toContain("Areas");
    expect(result).toContain("Projects");
  });

  it("error message includes both folder names for equality check", () => {
    const result = validateParaFolderPath("Resources", "archivePath", defaultSettings);
    expect(result).toContain("Archive");
    expect(result).toContain("Resources");
  });

  it("validates against multiple other paths", () => {
    // Changing projectsPath to equal one of the other paths should fail
    const result1 = validateParaFolderPath("Areas", "projectsPath", defaultSettings);
    expect(result1).not.toBeNull();

    const result2 = validateParaFolderPath("Resources", "projectsPath", defaultSettings);
    expect(result2).not.toBeNull();

    const result3 = validateParaFolderPath("Archive", "projectsPath", defaultSettings);
    expect(result3).not.toBeNull();
  });

  it("allows paths with similar names but different roots", () => {
    defaultSettings.projectsPath = "Work/Projects";
    defaultSettings.areasPath = "Work/Areas";
    const result = validateParaFolderPath("Home/Projects", "resourcesPath", defaultSettings);
    expect(result).toBeNull();
  });

  it("catches nesting in deeply nested paths", () => {
    defaultSettings.projectsPath = "Work/Active/Projects";
    const result = validateParaFolderPath("Work/Active/Projects/MyProject", "areasPath", defaultSettings);
    expect(result).not.toBeNull();
  });

  it("handles field with trailing/leading slashes", () => {
    // "/Projects/" normalizes to "Projects" which is equal to projectsPath
    // This is detected as nesting (since isNestedPath returns true for equal paths)
    const result = validateParaFolderPath("/Projects/", "areasPath", defaultSettings);
    expect(result).not.toBeNull();
    // Will be detected as nested since isNestedPath considers equal paths as nested
    expect(result).toContain("cannot be nested");
  });

  it("validates only against other fields, not itself", () => {
    const result = validateParaFolderPath("Projects", "projectsPath", defaultSettings);
    expect(result).toBeNull(); // No error because we're checking against other fields only
  });

  it("returns error when any other field fails validation", () => {
    // Testing that validation checks all fields
    defaultSettings.areasPath = "Projects/Areas";
    const result = validateParaFolderPath("Projects", "projectsPath", defaultSettings);
    expect(result).not.toBeNull();
  });
});

describe("extractDateFormatFromProjectFormat", () => {
  it("extracts date format before {{name}}", () => {
    expect(extractDateFormatFromProjectFormat("YYYY-MM-DD {{name}}")).toBe("YYYY-MM-DD ");
    expect(extractDateFormatFromProjectFormat("YYMMDD - {{name}}")).toBe("YYMMDD - ");
    expect(extractDateFormatFromProjectFormat("YYYYMMDD_{{name}}")).toBe("YYYYMMDD_");
  });

  it("handles format with {{name}} at start", () => {
    expect(extractDateFormatFromProjectFormat("{{name}} YYYY-MM-DD")).toBe("");
  });

  it("returns full string if no {{name}} placeholder", () => {
    expect(extractDateFormatFromProjectFormat("YYYY-MM-DD")).toBe("YYYY-MM-DD");
  });

  it("handles empty string", () => {
    expect(extractDateFormatFromProjectFormat("")).toBe("");
  });
});

describe("compareByLastModified", () => {
  it("returns negative when a is newer (larger mtime)", () => {
    const a = { mtime: 2000 };
    const b = { mtime: 1000 };
    expect(compareByLastModified(a, b)).toBeLessThan(0);
  });

  it("returns positive when b is newer (larger mtime)", () => {
    const a = { mtime: 1000 };
    const b = { mtime: 2000 };
    expect(compareByLastModified(a, b)).toBeGreaterThan(0);
  });

  it("returns zero when mtimes are equal", () => {
    const a = { mtime: 1500 };
    const b = { mtime: 1500 };
    expect(compareByLastModified(a, b)).toBe(0);
  });

  it("sorts newest first when used with Array.sort()", () => {
    const items = [
      { name: "Old", mtime: 1000 },
      { name: "Newest", mtime: 3000 },
      { name: "Middle", mtime: 2000 },
    ];
    items.sort((a, b) => compareByLastModified(a, b));
    expect(items.map((i) => i.name)).toEqual(["Newest", "Middle", "Old"]);
  });
});

