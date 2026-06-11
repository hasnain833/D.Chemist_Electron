import { useEffect, useRef } from 'react';

export function useBarcodeScanner(onScan: (barcode: string) => void) {
  const buffer = useRef<string>('');
  const lastKeyTime = useRef<number>(Date.now());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore functional keys to not mess up other shortcuts
      if (e.key.startsWith('F') || e.ctrlKey || e.altKey || e.metaKey) return;

      const now = Date.now();
      const elapsed = now - lastKeyTime.current;
      lastKeyTime.current = now;

      if (e.key === 'Enter') {
        if (buffer.current.length >= 5) {
          // It's a scanned barcode
          onScan(buffer.current);
          buffer.current = '';
          if (elapsed < 80) {
            e.preventDefault();
            e.stopPropagation();
          }
        } else {
          buffer.current = '';
        }
        return;
      }

      if (e.key.length === 1) { // Single character
        if (elapsed < 80) {
          buffer.current += e.key;
        } else {
          buffer.current = e.key;
        }
      } else {
        if (elapsed > 100) buffer.current = '';
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onScan]);
}
