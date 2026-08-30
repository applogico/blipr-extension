// One source for both engines. Chrome runs the background as a service
// worker; Firefox runs it as an event page, and needs a gecko id — that id
// is the add-on's identity and can never change.
import pkg from "../package.json" with { type: "json" };

export type Target = "chrome" | "firefox";

const icons = {
  16: "icons/icon-16.png",
  32: "icons/icon-32.png",
  48: "icons/icon-48.png",
  128: "icons/icon-128.png",
};

export function manifest(target: Target): Record<string, unknown> {
  const background =
    target === "chrome"
      ? { service_worker: "background/index.js" }
      : { scripts: ["background/index.js"] };

  return {
    manifest_version: 3,
    name: "Blipr",
    version: pkg.version,
    // Chrome shows this as the store listing's short summary, capped at 132 characters.
    description:
      "Watch any page for an element and get a push on your iPhone the moment it appears, or the moment the last one goes away.",
    icons,
    // No blanket host access at install: a watch asks for its own origin, so
    // the install prompt stays quiet and Firefox — where host permissions are
    // optional anyway — behaves the same as Chrome.
    // Alarms are for the optional page refresh only: a cooldown is still a
    // stored timestamp, because nothing may outlive a handler.
    permissions: ["storage", "scripting", "activeTab", "alarms"],
    optional_host_permissions: ["<all_urls>"],
    background,
    action: { default_title: "Blipr", default_icon: icons, default_popup: "popup/popup.html" },
    options_ui: { page: "options/options.html", open_in_tab: true },
    ...(target === "firefox"
      ? {
          browser_specific_settings: {
            gecko: {
              id: "page-watch@blipr.dev",
              // 128 is where Firefox learned `optional_host_permissions`.
              strict_min_version: "128.0",
              data_collection_permissions: { required: ["none"] },
            },
          },
        }
      : {}),
  };
}
