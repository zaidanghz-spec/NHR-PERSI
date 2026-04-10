import { useEffect, useRef } from "react";

interface QRCodeProps {
  value: string;
  size?: number;
  fgColor?: string;
  bgColor?: string;
  className?: string;
}

export function QRCodeDisplay({ value, size = 200, fgColor = "#0F4C81", bgColor = "#ffffff", className }: QRCodeProps) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&color=${fgColor.replace("#", "")}&bgcolor=${bgColor.replace("#", "")}&margin=10&format=svg`;

  return (
    <div className={className} style={{ width: size, height: size }}>
      <img
        src={qrUrl}
        alt="QR Code"
        width={size}
        height={size}
        style={{ display: "block" }}
        crossOrigin="anonymous"
      />
    </div>
  );
}

export function QRCodeSVGCanvas({ value, size = 200, fgColor = "#0F4C81", bgColor = "#ffffff" }: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
    };
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&color=${fgColor.replace("#", "")}&bgcolor=${bgColor.replace("#", "")}&margin=10&format=png`;
  }, [value, size, fgColor, bgColor]);

  return <canvas ref={canvasRef} width={size} height={size} />;
}
