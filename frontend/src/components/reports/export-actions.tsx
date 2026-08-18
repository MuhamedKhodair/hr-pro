'use client';

import { FileSpreadsheet, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';

interface ExportActionsProps {
  excelPath: string;
  excelFilename: string;
  printPath?: string;
}

export function ExportActions({ excelPath, excelFilename, printPath }: ExportActionsProps) {
  const { t } = useTranslation();

  const handleExcel = async () => {
    try {
      await api.download(excelPath, excelFilename);
    } catch (err: any) {
      alert(err.message || 'Export failed');
    }
  };

  const handlePrint = () => {
    window.open(`/print?${printPath}`, '_blank', 'noopener');
  };

  return (
    <>
      <Button variant="outline" onClick={handleExcel} className="gap-2" title={t('Export Excel')}>
        <FileSpreadsheet className="h-4 w-4" /> Excel
      </Button>
      {printPath && (
        <Button variant="outline" onClick={handlePrint} className="gap-2" title={t('Print / PDF')}>
          <Printer className="h-4 w-4" /> {t('Print / PDF')}
        </Button>
      )}
    </>
  );
}