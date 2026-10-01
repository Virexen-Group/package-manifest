import { describe, expect, it } from "vitest";
import { checkPackage, compareVersions, isRange, maxSatisfying, satisfies } from "../src/index.js";

describe("version ranges", () => {
  it("matches caret, tilde, comparisons, x-ranges and alternatives like npm", () => {
    const cases: Array<[string, string, boolean]> = [
      ["1.2.3", "^1.2.0", true], ["1.9.0", "^1.2.0", true], ["2.0.0", "^1.2.0", false], ["1.1.9", "^1.2.0", false],
      ["0.2.5", "^0.2.1", true], ["0.3.0", "^0.2.1", false], ["0.0.3", "^0.0.3", true], ["0.0.4", "^0.0.3", false],
      ["1.2.9", "~1.2.0", true], ["1.3.0", "~1.2.0", false],
      ["1.10.0", ">=1.9.0", true], ["1.8.9", ">=1.9.0", false], ["1.9.5", ">=1.9.0 <2.0.0", true], ["2.0.0", ">=1.9.0 <2.0.0", false],
      ["3.1.0", "1.x || ^3.0.0", true], ["2.1.0", "1.x || ^3.0.0", false], ["5.0.0", "*", true], ["1.2.3", "1.2.3", true], ["1.2.4", "1.2.3", false],
      // Prereleases only when asked for
      ["1.3.0-beta.1", "^1.2.0", false], ["1.3.0-beta.2", ">=1.3.0-beta.1", true], ["2.0.0-rc.1", "^1.2.0", false],
    ];
    for (const [version, range, expected] of cases) expect(satisfies(version, range), `${version} in ${range}`).toBe(expected);
    expect(isRange("^1.2.0")).toBe(true);
    expect(isRange("banana")).toBe(false);
    expect(maxSatisfying(["1.0.0", "1.4.2", "2.0.0", "1.5.0-beta.1"], "^1.0.0")).toBe("1.4.2");
    expect(["1.0.0", "1.0.0-rc.1", "1.0.0-beta.2", "1.0.0-beta.10", "0.9.9"].sort(compareVersions)).toEqual(["0.9.9", "1.0.0-beta.2", "1.0.0-beta.10", "1.0.0-rc.1", "1.0.0"]);
  });
});

const widget = (virexen: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  name: "@virexen-group/widget-latest-news",
  version: "2.3.0",
  virexen: { type: "widget", id: "latest-news", name: "Latest News", developer: { name: "Virexen Group", identifier: "com.virexengroup" }, compatibility: { cms: ">=1.10.0" }, ...virexen },
  ...extra,
});

describe("package checks", () => {
  it("accepts a complete widget and template, and the matching tag", () => {
    const result = checkPackage(widget({
      permissions: ["website:read", "widget-data:read", "widget-data:write", "dashboard:register", "public-routes:register"],
      cms: { dashboard: { label: "Latest News", icon: "newspaper", route: "/widgets/latest-news" } },
      frontend: { sections: [{ id: "news-cards", name: "News cards" }], publicPages: [{ id: "news", name: "News", defaultSlug: "news" }] },
    }), { tag: "v2.3.0" });
    expect(result.ok, JSON.stringify(result)).toBe(true);
    const template = checkPackage({
      name: "@virexen-group/template-camglen-buddies",
      version: "3.2.0",
      virexen: {
        type: "template", id: "camglen-buddies", name: "Camglen Buddies", developer: { name: "Virexen Group", identifier: "com.virexengroup" },
        compatibility: { cms: ">=1.10.0" }, runtime: { sharedApi: 1 },
        dependencies: { widgets: { required: { "latest-news": "^2.0.0" }, recommended: { events: "^1.0.0" } } },
      },
    });
    expect(template.ok, JSON.stringify(template)).toBe(true);
    if (template.ok && template.manifest.type === "template") expect(template.manifest.runtime).toEqual({ root: "runtime", entry: "index.js", style: "style.css", sharedApi: 1 });
  });

  it("reports every problem: tag, name, permissions, routes, icons, ranges and paths", () => {
    const result = checkPackage(widget({
      version: "2.2.0",
      compatibility: { cms: "latest" },
      cms: { dashboard: { label: "News", icon: "<svg onload=x>", route: "/widgets/other" } },
      frontend: { entry: "../outside.js", publicPages: [{ id: "news", name: "News", defaultSlug: "news" }] },
    }, { name: "@virexen-group/latest-news" }), { tag: "v2.3.1" });
    expect(result.ok).toBe(false);
    const errors = result.ok ? [] : result.errors.join("\n");
    expect(errors).toContain("release tag");
    expect(errors).toContain("virexen.compatibility.cms");
    expect(errors).toContain("virexen.cms.dashboard.icon");
    expect(errors).toContain("virexen.frontend.entry");
  });

  it("checks consistency once the shape is right", () => {
    const result = checkPackage(widget({ version: "2.2.0", cms: { dashboard: { label: "News", icon: "newspaper", route: "/widgets/other" } }, frontend: { publicPages: [{ id: "news", name: "News", defaultSlug: "news" }] } }, { name: "@virexen-group/latest-news" }));
    expect(result.ok ? [] : result.errors).toEqual([
      "virexen.version 2.2.0 doesn't match package.json version 2.3.0",
      "package.json name should be \"@virexen-group/widget-latest-news\" for widget \"latest-news\"",
      "A dashboard module needs the \"dashboard:register\" permission",
      "The dashboard route must be under /widgets/latest-news",
      "Public pages need the \"public-routes:register\" permission",
    ]);
  });
});
