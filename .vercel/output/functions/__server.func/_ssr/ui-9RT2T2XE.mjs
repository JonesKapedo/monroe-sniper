import { Y as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as clsx } from "../_libs/clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ui-9RT2T2XE.js
var import_jsx_runtime = require_jsx_runtime();
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
function Button({ variant = "solid", className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		className: cn("inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition disabled:opacity-40", variant === "solid" && "bg-brass text-brass-ink hover:bg-brass/90", variant === "ghost" && "border border-line bg-panel-2 text-cream hover:border-brass", variant === "danger" && "bg-loss text-ink", className),
		...props
	});
}
function Card({ className, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
		className: cn("rounded-xl border border-line bg-panel p-4", className),
		children
	});
}
function Label({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-xs tracking-wide text-faint uppercase",
		children
	});
}
//#endregion
export { cn as i, Card as n, Label as r, Button as t };
