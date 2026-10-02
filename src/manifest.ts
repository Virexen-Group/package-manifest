import { z } from "zod";
import { isRange, isVersion } from "./semver.js";

// The Silverline package manifest: what a template or widget package is, what it needs and what it
// provides. It lives in the package's package.json under "virexen" (the convention Virexen API
// modules already use), so the registry's metadata carries it and it can be checked before
// anything is downloaded. The package's own version (package.json "version", = git tag without "v")
// is the manifest's version.

export const HOSTING_TYPES = ["website_builder", "static", "nodejs"] as const;

/** What a widget may ask for. Anything not granted here, it can't do (see the Widget SDK). */
export const PERMISSIONS = [
  "website:read",
  "widget-data:read",
  "widget-data:write",
  "content:read",
  "assets:read",
  "assets:write",
  "mail:send",
  "public-routes:register",
  "dashboard:register",
] as const;

/** Dashboard icons are names from this set, never markup */
export const DASHBOARD_ICONS = [
  "newspaper", "calendar", "image", "images", "form", "inbox", "users", "user", "handshake", "shield", "star",
  "mail", "megaphone", "file-text", "layout", "settings", "puzzle", "quote", "heart", "map", "shopping-bag",
] as const;

export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const slug = z.string().regex(SLUG, "lowercase letters, digits and single hyphens").max(60);
const range = z.string().max(200).refine(isRange, "not a valid version range (e.g. ^1.2.0, >=1.9.0 <2.0.0)");
const filePath = z.string().max(300).regex(/^(?!\/)(?!.*(?:^|\/)\.\.?(?:\/|$))[\w./@-]+$/, "a relative path inside the package");

const base = {
  /** Manifest format version */
  schema: z.literal(1).default(1),
  id: slug,
  name: z.string().min(1).max(100),
  description: z.string().max(1000).default(""),
  developer: z.object({
    name: z.string().min(1).max(100),
    /** Reverse-DNS style publisher ID, e.g. com.virexengroup */
    identifier: z.string().regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/),
    url: z.string().url().optional(),
  }),
  /** Optional; when present it must equal the package's version */
  version: z.string().refine(isVersion, "MAJOR.MINOR.PATCH").optional(),
  compatibility: z.object({
    /** CMS versions this package works with, e.g. ">=1.10.0" */
    cms: range,
    /** Widget runtime / SDK versions (widgets) */
    widgetRuntime: range.optional(),
  }),
  /** Hosting types it can be installed on */
  hostingTypes: z.array(z.enum(HOSTING_TYPES)).min(1).default(["website_builder"]),
  permissions: z.array(z.enum(PERMISSIONS)).default([]),
};

const widgetDependencies = z.record(slug, range);

export const templateManifest = z.object({
  ...base,
  type: z.literal("template"),
  /** The runtime build the website loader imports (shared libraries from the app, API version) */
  runtime: z.object({
    root: filePath.default("runtime"),
    entry: filePath.default("index.js"),
    style: filePath.nullable().default("style.css"),
    sharedApi: z.number().int().positive(),
  }),
  /** Widgets the template works with: required are installed with it, recommended are offered */
  dependencies: z.object({
    widgets: z.object({
      required: widgetDependencies.default({}),
      recommended: widgetDependencies.default({}),
      optional: widgetDependencies.default({}),
    }).default({}),
  }).default({}),
  /** The template's own manifest (sections, page types, capabilities, design system, PWA…) */
  template: z.record(z.unknown()).default({}),
});

/** A setting the CMS renders and validates (widget settings, section display settings) */
export const settingField = z.object({
  key: z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,40}$/),
  label: z.string().min(1).max(80),
  type: z.enum(["boolean", "text", "textarea", "number", "select", "url", "email"]),
  default: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  help: z.string().max(300).optional(),
  options: z.array(z.object({ value: z.string().max(80), label: z.string().max(80) })).max(50).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  maxLength: z.number().int().positive().max(100_000).optional(),
  required: z.boolean().optional(),
  /** Sent to websites with the widget's public data; everything else stays in the CMS */
  public: z.boolean().optional(),
});
export type SettingField = z.infer<typeof settingField>;

const CONTENT_FIELDS = ["eyebrow", "headline", "body", "cta", "ctaHref"] as const;

export const widgetManifest = z.object({
  ...base,
  type: z.literal("widget"),
  /** Earlier IDs this widget answers to (e.g. "contact-forms" for "forms") */
  aliases: z.array(slug).max(10).default([]),
  /** What it does for templates (templates support capabilities, e.g. "news"); defaults to the ID */
  capability: slug.optional(),
  /** Global settings (the widget's settings page) */
  settings: z.array(settingField).max(100).default([]),
  cms: z.object({
    /** Every widget has a settings page (/widgets/<id>/settings) */
    settings: z.literal(true).default(true),
    dashboard: z.object({
      label: z.string().min(1).max(40),
      icon: z.enum(DASHBOARD_ICONS),
      route: z.string().regex(/^\/widgets\/[a-z0-9-]+(\/[a-z0-9-]+)*$/),
    }).optional(),
    /** Control panel bundle (settings page, dashboard module), relative to the package */
    entry: filePath.optional(),
  }).default({}),
  frontend: z.object({
    /** Website bundle (sections, public pages), relative to the package */
    entry: filePath.optional(),
    sections: z.array(z.object({
      id: slug,
      name: z.string().min(1).max(80),
      description: z.string().max(300).default(""),
      category: z.string().max(40).default("Widgets"),
      /** Display settings for one placed section */
      settings: z.array(settingField).max(50).default([]),
      /** Page-owned text around the widget's data */
      contentFields: z.array(z.enum(CONTENT_FIELDS)).default([]),
      defaultContent: z.record(z.string().max(500)).default({}),
      /** Older section type this replaces in saved pages (e.g. "featuredNews") */
      legacyType: z.string().regex(/^[a-zA-Z][a-zA-Z0-9-]{0,60}$/).optional(),
    })).max(50).default([]),
    publicPages: z.array(z.object({
      id: slug,
      name: z.string().min(1).max(80),
      defaultSlug: z.string().regex(/^[a-z0-9-]+(\/[a-z0-9-]+)*$/).max(100),
      /** Paths under the page's slug it answers ("" = the page itself, ":slug" = e.g. one article) */
      paths: z.array(z.string().regex(/^$|^(?::?[a-z][a-zA-Z0-9-]*)(\/:?[a-z][a-zA-Z0-9-]*)*$/)).min(1).max(10).default([""]),
    })).max(10).default([]),
  }).default({}),
  /** Server code the widget runtime loads (API routes, hooks), relative to the package */
  server: z.object({ entry: filePath }).optional(),
});

export const packageManifest = z.discriminatedUnion("type", [templateManifest, widgetManifest]);

export type TemplateManifest = z.infer<typeof templateManifest>;
export type WidgetManifest = z.infer<typeof widgetManifest>;
export type PackageManifest = z.infer<typeof packageManifest>;

export type PackageCheck = { ok: true; manifest: PackageManifest; name: string; version: string } | { ok: false; errors: string[] };

/** Package names: "@<scope>/<type>-<id>", e.g. @virexen-group/widget-latest-news */
export const packageNameFor = (scope: string, type: "template" | "widget", id: string) => `${scope}/${type}-${id}`;

/**
 * Checks a package.json: name, version, the manifest and its internal consistency, and (when
 * given) that the release tag is v<version>. Returns every problem, not just the first.
 */
export function checkPackage(packageJson: unknown, options: { scope?: string; tag?: string } = {}): PackageCheck {
  const errors: string[] = [];
  const pkg = (packageJson && typeof packageJson === "object" ? packageJson : {}) as { name?: unknown; version?: unknown; virexen?: unknown };
  const version = typeof pkg.version === "string" ? pkg.version : "";
  if (!isVersion(version)) errors.push(`package.json version "${String(pkg.version)}" isn't MAJOR.MINOR.PATCH`);
  if (options.tag !== undefined && options.tag !== `v${version}`) errors.push(`The release tag "${options.tag}" doesn't match package.json version ${version} (expected v${version})`);
  const parsed = packageManifest.safeParse(pkg.virexen);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) errors.push(`virexen.${issue.path.join(".") || "(root)"}: ${issue.message}`);
    return { ok: false, errors };
  }
  const manifest = parsed.data;
  if (manifest.version !== undefined && manifest.version !== version) errors.push(`virexen.version ${manifest.version} doesn't match package.json version ${version}`);
  const scope = options.scope ?? "@virexen-group";
  const expectedName = packageNameFor(scope, manifest.type, manifest.id);
  if (pkg.name !== expectedName) errors.push(`package.json name should be "${expectedName}" for ${manifest.type} "${manifest.id}"`);
  if (manifest.type === "widget") {
    if (manifest.cms.dashboard && !manifest.permissions.includes("dashboard:register")) errors.push("A dashboard module needs the \"dashboard:register\" permission");
    if (manifest.cms.dashboard && !manifest.cms.dashboard.route.startsWith(`/widgets/${manifest.id}`)) errors.push(`The dashboard route must be under /widgets/${manifest.id}`);
    if (manifest.frontend.publicPages.length && !manifest.permissions.includes("public-routes:register")) errors.push("Public pages need the \"public-routes:register\" permission");
    if (manifest.aliases.includes(manifest.id)) errors.push("An alias can't be the widget's own ID");
  } else {
    const all = Object.entries(manifest.dependencies.widgets).flatMap(([kind, list]) => Object.keys(list).map((id) => ({ kind, id })));
    const seen = new Map<string, string>();
    for (const { kind, id } of all) {
      if (seen.has(id)) errors.push(`Widget "${id}" is listed as both ${seen.get(id)} and ${kind}`);
      seen.set(id, kind);
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, manifest, name: String(pkg.name), version };
}
