import React from "react";
import type { Panel } from "@/types/panel";

export interface PanelSidebarProps {
  panel?: Panel | null;
  onClose: () => void;
}

export const PanelSidebar: React.FC<PanelSidebarProps> = ({ panel, onClose }) => {
  const visible = !!panel;

  return (
    <aside
      aria-hidden={!visible}
      className={`fixed top-0 left-0 h-full w-[360px] bg-white border-r border-neutral-200 shadow-xl transition-transform duration-200 ease-out z-40 ${
        visible ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="font-semibold text-neutral-800">
          {panel ? `Panel ${panel.id}` : "Panel"}
        </div>
        <button
          onClick={onClose}
          className="rounded px-2 py-1 text-sm border hover:bg-neutral-50"
        >
          Close
        </button>
      </div>

      {!panel ? (
        <div className="p-4 text-sm text-neutral-500">No panel selected.</div>
      ) : (
        <div className="p-4 space-y-6 overflow-y-auto h-[calc(100%-49px)]">
          <section>
            <h3 className="text-sm font-semibold text-neutral-700 mb-2">Location</h3>
            <div className="text-sm text-neutral-700">
              <div>World X: {panel.meta?.location?.x?.toFixed?.(2) ?? "-"}</div>
              <div>World Y: {panel.meta?.location?.y?.toFixed?.(2) ?? "-"}</div>
              {panel.meta?.location?.gridCell && (
                <div>
                  Grid Cell: r{panel.meta.location.gridCell.row}, c{panel.meta.location.gridCell.col}
                </div>
              )}
              <div>Installed: {panel.meta?.installedAt ?? "-"}</div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-neutral-700 mb-2">Welder</h3>
            <div className="text-sm text-neutral-700">
              <div>Name: {panel.meta?.welder?.name ?? "-"}</div>
              <div>Shift: {panel.meta?.welder?.shift ?? "-"}</div>
              <div>Method: {panel.meta?.welder?.method ?? "-"}</div>
              <div>Notes: {panel.meta?.welder?.notes ?? "-"}</div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-neutral-700 mb-2">Air Test</h3>
            <div className="text-sm text-neutral-700">
              <div>Result: {panel.meta?.airTest?.result ?? "-"}</div>
              <div>Pressure: {panel.meta?.airTest?.pressure ?? "-"}</div>
              <div>Duration (mins): {panel.meta?.airTest?.durationMins ?? "-"}</div>
              <div>Performed By: {panel.meta?.airTest?.performedBy ?? "-"}</div>
              <div>Date: {panel.meta?.airTest?.date ?? "-"}</div>
              <div>Notes: {panel.meta?.airTest?.notes ?? "-"}</div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-neutral-700 mb-2">Repairs</h3>
            <div className="space-y-2">
              {(panel.meta?.repairs ?? []).length === 0 && (
                <div className="text-sm text-neutral-500">No repairs recorded.</div>
              )}
              {(panel.meta?.repairs ?? []).map((r) => (
                <div key={r.id} className="rounded border p-2">
                  <div className="text-sm">Type: {r.type}</div>
                  {r.description && <div className="text-sm">Desc: {r.description}</div>}
                  {r.coords && (
                    <div className="text-xs text-neutral-600">
                      @ ({r.coords.x.toFixed(2)}, {r.coords.y.toFixed(2)})
                    </div>
                  )}
                  <div className="text-xs text-neutral-500">Created: {r.createdAt}</div>
                  {r.updatedAt && (
                    <div className="text-xs text-neutral-500">Updated: {r.updatedAt}</div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-neutral-700 mb-2">Destructs</h3>
            <div className="space-y-2">
              {(panel.meta?.destructs ?? []).length === 0 && (
                <div className="text-sm text-neutral-500">No destructs recorded.</div>
              )}
              {(panel.meta?.destructs ?? []).map((d) => (
                <div key={d.id} className="rounded border p-2">
                  {d.description && <div className="text-sm">Desc: {d.description}</div>}
                  <div className="text-xs text-neutral-500">Created: {d.createdAt}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </aside>
  );
};

export default PanelSidebar;
