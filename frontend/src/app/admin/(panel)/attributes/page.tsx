"use client";

import { useState } from "react";
import { RequirePermission } from "@/components/admin/guard";
import { PageHeader, Tabs } from "@/components/admin/ui";
import { AttributesTab } from "@/components/admin/catalog/attributes-tab";
import { OptionsTab } from "@/components/admin/catalog/options-tab";
import { SizeChartsTab } from "@/components/admin/catalog/size-charts-tab";

const TABS = [
  { value: "attributes", label: "Attributes" },
  { value: "options", label: "Sizes & Colours" },
  { value: "size-charts", label: "Size charts" },
];

export default function AttributesPage() {
  const [tab, setTab] = useState("attributes");
  return (
    <RequirePermission permission="attributes.manage">
      <PageHeader title="Attributes & Size Charts" description="The vocabulary used to describe products: attributes and filters, variant sizes and colours, and measurement charts." />
      <div className="space-y-6">
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
        <div role="tabpanel" aria-label={TABS.find((t) => t.value === tab)?.label}>
          {tab === "attributes" && <AttributesTab />}
          {tab === "options" && <OptionsTab />}
          {tab === "size-charts" && <SizeChartsTab />}
        </div>
      </div>
    </RequirePermission>
  );
}
