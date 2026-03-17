// Copyright 2026 Fractalyze Inc. All rights reserved.

import { AdminPanel } from "./admin-panel";
import { GoalsPanel } from "./goals-panel";
import { DisplayNamesPanel } from "./display-names-panel";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  return (
    <div className="space-y-8">
      <GoalsPanel />
      <DisplayNamesPanel />
      <AdminPanel />
    </div>
  );
}
