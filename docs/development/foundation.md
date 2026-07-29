# Foundation and cross-cutting development contract

This document is the implementation contract established by PLAN-001. It
applies to every later vertical slice.

## Boundaries

The plugin supports intuitive structure editing in the WordPress block editor.
The Foundation itself registers no blocks, formats, editor plugins, REST
routes, Ajax handlers, cron events, database tables, options, transients, meta,
public hooks, or runtime JavaScript/CSS.

Runtime PHP uses PHP 8.3. The main file
`app/yamabiko-blocks.php` is deliberately limited to PHP 7.4 syntax
so that it can reject an unsupported host before loading Composer or runtime
code.
Approved PLAN-002 selected WordPress 6.8 and PHP 8.3 as the first public
minimums. Publish those values in plugin metadata together with the PLAN-002
runtime implementation; until then, do not infer published metadata from the
development runtime alone.

Feature code is co-located under `app/src/<Feature>/`. Do not create
future feature directories, empty classes, or a `shared/` directory
pre-emptively.
Move code to `shared/` only after multiple real features use it.

## Stable identifiers

| Surface                     | Required form            |
| --------------------------- | ------------------------ |
| Plugin slug and text domain | `yamabiko-blocks`        |
| PHP namespace               | `YamabikoLab\Blocks\`    |
| Global PHP function         | `yamabiko_blocks_`       |
| PHP constant                | `YAMABIKO_BLOCKS_`       |
| Option or transient         | `yamabiko_blocks_`       |
| Private meta key            | `_yamabiko_blocks_`      |
| Action or filter            | `yamabiko-blocks/`       |
| REST namespace              | `yamabiko-blocks/v1`     |
| Script or style handle      | `yamabiko-blocks-`       |
| Block namespace             | `yamabiko/`              |
| CSS class                   | `yamabiko-blocks-`       |
| HTML data attribute         | `data-yamabiko-blocks-*` |
| npm scope                   | `@yamabikolab`           |

Do not introduce generic names or prefixes reserved by WordPress and other
products, such as `wp_`. Namespaces are the primary PHP collision boundary.
Do not silently suppress duplicate declarations belonging to this plugin.

After release, block names and attributes, saved HTML, option and meta names,
and public hooks are compatibility contracts. A breaking change requires an
explicit deprecation, migration, or compatibility decision.

## WordPress lifecycle

- Prefer public WordPress APIs, actions, and filters. Do not alter core, themes,
  or another plugin's state.
- Register initialization and feature work on the narrowest suitable hook.
- Separate editor, front-end, and admin responsibilities and load assets only
  on screens that need them.
- Activation does the minimum necessary initialization. Deactivation never
  deletes durable data. Durable deletion belongs exclusively to uninstall.
- The Foundation stores nothing, so it has no activation/deactivation handlers
  and no `uninstall.php`.

## Security and privacy

- Treat request, REST, database, option, meta, and decoded external values as
  untrusted.
- Validate expected type, shape, allowed value, identifier, and range before
  relying on input. Sanitize and normalize separately with functions
  appropriate to the data and storage context.
- Sanitization does not replace validation, authorization, or output escaping.
- Every privileged custom mutation requires authorization appropriate to the
  affected object. Use the relevant capability check when the operation is
  user-authorized.
- Verify a nonce at cookie-authenticated browser boundaries where WordPress
  requires CSRF protection or confirmation of user intent, including applicable
  forms, `admin-post`, Ajax, and REST requests. Do not impose a nonce on
  authentication methods such as application passwords that do not use one.
- A nonce is not authorization and never replaces a capability check or REST
  permission decision.
- Every REST route requires a meaningful `permission_callback`; validate and
  authorize mutations inside the route's actual request context.
- Escape at the final HTML, attribute, URL, JavaScript, JSON, or other output
  boundary for that context.
- Prefer WordPress data APIs. If direct SQL is unavoidable, use
  `$wpdb->prepare()` for variables.
- Do not use `eval` or unsafe deserialization.
- The default product performs no telemetry or external communication and loads
  no remote fonts or JavaScript. A later plan must document destination,
  purpose, and exact data before adding an external service.
- Never expose secrets, credentials, personal data, stack traces, internal
  paths, or exception details in production UI or logs.

## Internationalization, accessibility, and errors

- Translate every user-visible string with text domain
  `yamabiko-blocks`. Put dynamic values in placeholders and escape the
  translated result for its output context.
- Prefer WordPress UI primitives and semantic HTML. Keyboard operation is
  required, and meaning cannot rely on color alone.
- Verify UI behavior in both editor and front end when both are applicable.
- Separate user-safe messages from developer diagnostics. Do not swallow
  failures; use `WP_Error` for recoverable errors where it fits the API.

## Dependencies and assets

- Add a dependency only after checking need, maintenance, license, known
  vulnerabilities, and overlap with WordPress.
- Separate runtime and development dependencies and commit both lockfiles.
- WordPress-provided React, ReactDOM, JSX runtime, and `@wordpress/*` packages
  remain external and resolve through WordPress script handles.
- Record licenses for code and assets included in the release. Do not ship
  remote or unlicensed fonts, images, or scripts.

## Review gate for later plans

Every vertical-slice plan must complete `docs/plans/TEMPLATE.md`, identify any
new stable surface or persisted data, and explicitly confirm this contract.
