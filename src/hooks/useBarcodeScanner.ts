import { useEffect, useRef } from 'react';

interface BarcodeScannerOptions {
  onScan: (barcode: string) => void;
  onError?: (error: string) => void;
  minLength?: number;
  timeout?: number;
}

/**
 * useBarcodeScanner
 * Captures keyboard wedge barcode scanner events across the application.
 * Differentiates rapid hardware scanner input from normal human typing based on speed/timeout.
 */
export function useBarcodeScanner({ onScan, onError, minLength = 5, timeout = 50 }: BarcodeScannerOptions) {
  const bufferRef = useRef<string>('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is natively typing in an input field and hasn't hit Enter
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isInputFocused = activeTag === 'input' || activeTag === 'textarea';

      // Most barcode scanners send 'Enter' as the suffix
      if (e.key === 'Enter') {
        if (bufferRef.current.length >= minLength) {
          onScan(bufferRef.current);
          if (isInputFocused) {
            e.preventDefault(); // Stop form submission
          }
        } else if (bufferRef.current.length > 0 && onError) {
          onError(`Scanned code too short (${bufferRef.current.length} chars). Optional wedge config?`);
        }
        
        bufferRef.current = '';
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        return;
      }

      // Add to buffer if it's a printable character
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // If we were typing normally in an input, don't capture unless we decide it's too fast
        if (isInputFocused) return;

        bufferRef.current += e.key;

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        // If typing stops for > 50ms, assume it was human typing and clear buffer
        timeoutRef.current = setTimeout(() => {
          bufferRef.current = '';
        }, timeout);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [onScan, onError, minLength, timeout]);
}
