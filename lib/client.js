window.__ModuleLoader__.load({
	id: "dsh-sdd-progress-xc",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		//#region src/client/index.tsx
		/**
		* dsh-sdd-progress-xc — browser half.
		*
		* Registers a right-sidebar tab showing SDD task progress + ledger.
		*/
		const inject = ["slots", "sidebarRightTabs"];
		const TAB_ID = "dsh-sdd-progress-xc/sdd-progress";
		const TAB_KIND = "sdd-progress";
		function statusIcon(status) {
			switch (status) {
				case "completed": return "✓";
				case "in_progress": return "⏳";
				default: return "○";
			}
		}
		function statusBg(status) {
			switch (status) {
				case "completed": return "#e8f5e9";
				case "in_progress": return "#fff3e0";
				default: return "#f5f5f5";
			}
		}
		function statusFg(status) {
			switch (status) {
				case "completed": return "#2e7d32";
				case "in_progress": return "#e65100";
				default: return "#757575";
			}
		}
		function SddProgressBody({ sessionId }) {
			const [data, setData] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(true);
			const [error, setError] = (0, react.useState)(null);
			const [activeTab, setActiveTab] = (0, react.useState)("tasks");
			const codeLabels = (0, react.useMemo)(() => ({
				copyLabel: "复制",
				copiedLabel: "已复制"
			}), []);
			const fetchProgress = (0, react.useCallback)(async () => {
				try {
					setLoading(true);
					setError(null);
					const q = sessionId ? "?sessionId=" + encodeURIComponent(sessionId) : "";
					const json = await (await fetch("/api/dsh-sdd-progress-xc/progress" + q, { cache: "no-store" })).json();
					if (json.ok) setData(json);
					else setError(json.error || "unknown error");
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setLoading(false);
				}
			}, [sessionId]);
			(0, react.useEffect)(() => {
				fetchProgress();
				const interval = setInterval(fetchProgress, 5e3);
				return () => clearInterval(interval);
			}, [fetchProgress]);
			if (loading && !data) return (0, react.createElement)("div", { style: {
				padding: 16,
				color: "#999",
				fontSize: 13
			} }, "Loading SDD progress...");
			if (error) return (0, react.createElement)("div", { style: {
				padding: 16,
				color: "#d32f2f",
				fontSize: 13
			} }, "Error: " + error);
			if (!data) return (0, react.createElement)("div", { style: {
				padding: 16,
				color: "#999",
				fontSize: 13
			} }, "No data");
			const todos = data.todos || [];
			const done = todos.filter((t) => t.status === "completed").length;
			const active = todos.filter((t) => t.status === "in_progress").length;
			const pending = todos.length - done - active;
			const tabBtn = function(tab, label) {
				const isActive = activeTab === tab;
				return (0, react.createElement)("button", {
					key: tab,
					onClick: () => setActiveTab(tab),
					style: {
						padding: "5px 12px",
						fontSize: 12,
						cursor: "pointer",
						border: "none",
						background: isActive ? "#eef2ff" : "transparent",
						color: isActive ? "#4f7cff" : "#666",
						fontWeight: isActive ? 600 : 400,
						borderRadius: "5px 5px 0 0",
						marginRight: 2
					}
				}, label);
			};
			return (0, react.createElement)("div", { style: {
				padding: 12,
				overflow: "auto",
				fontSize: 13,
				lineHeight: 1.5,
				height: "100%",
				display: "flex",
				flexDirection: "column"
			} }, (0, react.createElement)("div", { style: {
				marginBottom: 8,
				paddingBottom: 8,
				borderBottom: "1px solid #e0e0e0",
				display: "flex",
				alignItems: "flex-start",
				gap: 8
			} }, (0, react.createElement)("div", { style: {
				flex: 1,
				minWidth: 0
			} }, (0, react.createElement)("div", { style: {
				fontSize: 11,
				color: "#999",
				marginBottom: 4,
				wordBreak: "break-all"
			} }, "Requirement: " + (data.requirementName || "unknown")), (0, react.createElement)("div", { style: {
				fontSize: 11,
				color: "#999",
				wordBreak: "break-all"
			} }, "Session: " + (data.sessionId || "unknown").slice(0, 12) + "...")), (0, react.createElement)("button", {
				onClick: fetchProgress,
				title: "Refresh tasks and ledger",
				style: {
					flexShrink: 0,
					padding: "3px 10px",
					fontSize: 11,
					lineHeight: "16px",
					border: "1px solid #ddd",
					borderRadius: 4,
					background: "#fafafa",
					cursor: "pointer",
					color: "#555"
				}
			}, "↻ Refresh")), (0, react.createElement)("div", { style: {
				display: "flex",
				marginBottom: 10,
				borderBottom: "1px solid #e5e5e5"
			} }, tabBtn("tasks", "Tasks"), tabBtn("ledger", "Progress Ledger")), activeTab === "tasks" && (0, react.createElement)("div", { style: {
				flex: 1,
				overflow: "auto"
			} }, (0, react.createElement)("div", { style: {
				display: "flex",
				gap: 8,
				marginBottom: 8,
				fontSize: 12
			} }, (0, react.createElement)("span", { style: { color: "#2e7d32" } }, "✓ " + done), (0, react.createElement)("span", { style: { color: "#e65100" } }, "⏳ " + active), (0, react.createElement)("span", { style: { color: "#757575" } }, "○ " + pending), (0, react.createElement)("span", { style: { color: "#999" } }, "/ " + todos.length + " total")), todos.length > 0 ? todos.map((t, i) => (0, react.createElement)("div", {
				key: i,
				style: {
					padding: "5px 8px",
					marginBottom: 3,
					background: statusBg(t.status),
					borderRadius: 4,
					fontSize: 12,
					display: "flex",
					alignItems: "flex-start",
					gap: 6
				}
			}, (0, react.createElement)("span", { style: {
				color: statusFg(t.status),
				flexShrink: 0
			} }, statusIcon(t.status)), (0, react.createElement)("span", { style: {
				color: t.status === "completed" ? "#999" : "#333",
				textDecoration: t.status === "completed" ? "line-through" : "none"
			} }, t.content))) : (0, react.createElement)("div", { style: {
				color: "#999",
				fontSize: 12,
				padding: "8px 0"
			} }, "No tasks yet")), activeTab === "ledger" && (0, react.createElement)("div", { style: {
				flex: 1,
				overflow: "auto"
			} }, data.ledger ? (0, react.createElement)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, {
				text: data.ledger,
				streaming: false,
				codeLabels
			}) : (0, react.createElement)("div", { style: {
				color: "#999",
				fontSize: 12,
				padding: "8px 0"
			} }, "No progress ledger found")));
		}
		function SddProgressTitle() {
			return (0, react.createElement)("span", null, "SDD Progress");
		}
		function sddProgressDefinition() {
			return {
				id: TAB_ID,
				kind: TAB_KIND,
				priority: "extension",
				title: () => "SDD Progress",
				guide: [{
					order: 0,
					title: () => "SDD Progress",
					description: () => "View SDD task progress and ledger for the current session"
				}]
			};
		}
		function apply(ctx) {
			const disposeDefinition = ctx.sidebarRightTabs.register(sddProgressDefinition());
			const disposeBody = ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
				name: "sidebar.right.pane.tab",
				key: TAB_ID,
				inject: (sessionId) => ({ sessionId })
			}, SddProgressBody));
			const disposeTitle = ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
				name: "sidebar.right.pane.tab.title",
				key: TAB_ID
			}, SddProgressTitle));
			ctx.effect(() => {
				return () => {
					disposeTitle();
					disposeBody();
					disposeDefinition();
				};
			}, "dsh-sdd-progress-xc: tab registration");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map