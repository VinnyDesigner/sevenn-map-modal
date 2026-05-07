import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import SevennMap from "@/components/SevennMap";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [open, setOpen] = useState(true);
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted">
      <button
        onClick={() => setOpen(true)}
        className="px-6 py-3 rounded-full bg-primary text-primary-foreground font-medium shadow-md hover:opacity-90 transition"
      >
        Open Sevenn Map
      </button>
      <SevennMap open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
