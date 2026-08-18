'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import { OrgChartModal } from '@/components/org-chart/org-chart-modal';

interface OrgChartContextValue {
  openOrgChart: () => void;
  closeOrgChart: () => void;
}

const OrgChartContext = createContext<OrgChartContextValue>({
  openOrgChart: () => {},
  closeOrgChart: () => {},
});

export function useOrgChart() {
  return useContext(OrgChartContext);
}

export function OrgChartProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const openOrgChart = useCallback(() => setOpen(true), []);
  const closeOrgChart = useCallback(() => setOpen(false), []);

  return (
    <OrgChartContext.Provider value={{ openOrgChart, closeOrgChart }}>
      {children}
      <OrgChartModal open={open} onClose={closeOrgChart} />
    </OrgChartContext.Provider>
  );
}
