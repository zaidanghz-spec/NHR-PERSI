import { useRef, useState, DragEvent, ChangeEvent } from "react";

interface ImageDropzoneProps {
  onImageChange: (base64: string) => void;
  currentImage?: string;
  className?: string;
}

export function ImageDropzone({ onImageChange, currentImage, className = "" }: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function processFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => { onImageChange(reader.result as string); };
    reader.readAsDataURL(file);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
        dragging ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:border-gray-400"
      } ${className}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onChange}
      />
      {currentImage && currentImage.startsWith("data:image") ? (
        <div className="space-y-2">
          <img src={currentImage} alt="Preview" className="max-h-32 mx-auto rounded object-contain" />
          <p className="text-xs text-gray-500">Klik atau seret untuk ganti gambar</p>
        </div>
      ) : (
        <div className="space-y-1 py-4">
          <p className="text-sm text-gray-500">Seret gambar ke sini atau klik untuk pilih</p>
          <p className="text-xs text-gray-400">PNG, JPG, GIF, WebP</p>
        </div>
      )}
    </div>
  );
}
