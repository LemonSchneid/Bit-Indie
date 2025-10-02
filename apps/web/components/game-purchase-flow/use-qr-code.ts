import { useEffect, useState } from "react";

import { buildQrCodeUrl } from "../../lib/qr-code";

export function useLightningQrCode(paymentRequest: string | null | undefined) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [qrGenerationFailed, setQrGenerationFailed] = useState(false);

  useEffect(() => {
    if (!paymentRequest) {
      setQrCodeUrl(null);
      setQrGenerationFailed(false);
      return undefined;
    }

    setQrCodeUrl(null);
    setQrGenerationFailed(false);

    try {
      const url = buildQrCodeUrl(paymentRequest);
      setQrCodeUrl(url);
    } catch (error) {
      console.error("Failed to generate Lightning invoice QR code.", error);
      setQrGenerationFailed(true);
    }

    return undefined;
  }, [paymentRequest]);

  return { qrCodeUrl, qrGenerationFailed } as const;
}
