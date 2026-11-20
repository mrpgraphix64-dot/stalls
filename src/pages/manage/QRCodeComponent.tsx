import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface CompactQRCodeProps {
  url: string;
  size?: number; // visual size in px (e.g. 54 = ~15mm at 96dpi)
  label?: string;
  title?: string;
}

export function CompactQRCode({ url, size = 52, label, title }: CompactQRCodeProps) {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    if (!url || typeof url !== 'string' || !url.trim().startsWith('http')) {
      setDataUrl('');
      return;
    }

    let isMounted = true;
    QRCode.toDataURL(url.trim(), {
      width: size * 3, // 3x for high-DPI print sharpness
      margin: 1,
      color: {
        dark: '#18181b', // zinc-900
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((res) => {
        if (isMounted) setDataUrl(res);
      })
      .catch(() => {
        if (isMounted) setDataUrl('');
      });

    return () => {
      isMounted = false;
    };
  }, [url, size]);

  if (!dataUrl) return null;

  return (
    <div
      className="flex flex-col items-center shrink-0"
      title={title || `Scan to open: ${url}`}
    >
      <img
        src={dataUrl}
        alt={label || 'QR Code'}
        width={size}
        height={size}
        className="rounded border border-zinc-300 bg-white p-0.5 object-contain"
        style={{ width: `${size}px`, height: `${size}px` }}
      />
      {label && (
        <span className="text-[7.5px] font-mono font-bold text-zinc-600 uppercase tracking-tight mt-0.5 whitespace-nowrap">
          {label}
        </span>
      )}
    </div>
  );
}
