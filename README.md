# @virexen-group/package-manifest

The Silverline package manifest for **templates** and **widgets**: schema, version ranges and the
release check every template and widget repository runs. Architecture:
`virexen-cms-api/docs/PLATFORM.md`.

The manifest lives in the package's `package.json` under `"virexen"`. The CMS reads it from the
downloaded archive after checking the archive against the registry's integrity hash (GitHub Packages
doesn't keep custom fields in its metadata). The package version (= the git tag without `v`) is the
manifest's version. Template and widget repositories run the release check from this repository's
source at a fixed tag (it's public; the package itself stays private).

```jsonc
{
  "name": "@virexen-group/widget-latest-news",      // @virexen-group/<type>-<id>
  "version": "2.3.0",
  "virexen": {
    "type": "widget",                                 // or "template"
    "id": "latest-news",
    "name": "Latest News",
    "developer": { "name": "Virexen Group", "identifier": "com.virexengroup" },
    "compatibility": { "cms": ">=1.10.0", "widgetRuntime": "^1.0.0" },
    "hostingTypes": ["website_builder"],
    "permissions": ["website:read", "widget-data:read", "widget-data:write", "dashboard:register", "public-routes:register"],
    "cms": { "dashboard": { "label": "Latest News", "icon": "newspaper", "route": "/widgets/latest-news" } },
    "frontend": { "sections": [{ "id": "news-cards", "name": "News cards" }], "publicPages": [{ "id": "news", "name": "News", "defaultSlug": "news" }] },
    "server": { "entry": "server/index.js" }
  }
}
```

Templates add `runtime` (`{ root, entry, style, sharedApi }`, the build the website loader imports),
`dependencies.widgets.{required,recommended,optional}` (widget ID → version range) and `template`
(the template's own manifest: sections, page types, design system…).

## Release check

```sh
npx virexen-package check            # in CI on a tag, the tag must be v<package version>
npx virexen-package check --tag v2.3.0
```

Checks the name, version, manifest, permissions (a dashboard needs `dashboard:register`, public pages
need `public-routes:register`), routes, ranges and, for templates, that the runtime build is there.
