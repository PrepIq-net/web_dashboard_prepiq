"use client";

import React, { useState } from "react";
import Cropper, { Point, Area } from "react-easy-crop";
import { Button } from "./button";
import { getCroppedImg } from "@/lib/utils/image";
import { Check, Xmark } from "iconoir-react";

interface ImageCropperProps {
  image: string;
  onCropComplete: (croppedImage: Blob) => void;
  onCancel: () => void;
  aspect?: number;
}

export function ImageCropper({
  image,
  onCropComplete,
  onCancel,
  aspect = 1,
}: ImageCropperProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const onCropAreaChange = (_: Area, pixelCrop: Area) => {
    setCroppedAreaPixels(pixelCrop);
  };

  const handleCrop = async () => {
    if (!croppedAreaPixels) return;
    setIsApplying(true);
    const croppedImage = await getCroppedImg(image, croppedAreaPixels);
    if (croppedImage) {
      onCropComplete(croppedImage);
    }
    setIsApplying(false);
  };

  return (
    /* Scrim — stopPropagation on the sheet prevents accidental dismiss on inner clicks */
    <div className="fixed inset-0 z-10000 flex items-center justify-center bg-[#141416]/85 backdrop-blur-sm animate-fade-in p-6">
      {/* Modal sheet — brand: radius 16px, shadow L2 */}
      <div
        className="relative w-full max-w-xl bg-[#1C1C1F] rounded-2xl border border-[#2E2E33] shadow-[0_8px_24px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden"
        style={{ maxHeight: "min(80vh, 680px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2E2E33]">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#A8821F]">
              Logo
            </p>
            <h3 className="font-display text-lg font-semibold text-[#F5F5F7] leading-snug mt-0.5">
              Adjust framing
            </h3>
          </div>

          {/* Close button — rectangular icon button, not rounded-full */}
          <button
            onClick={onCancel}
            aria-label="Close"
            className="h-8 w-8 flex items-center justify-center rounded-md text-[#8E8E93] hover:text-[#F5F5F7] hover:bg-[#232327] transition-colors duration-150"
          >
            <Xmark className="h-5 w-5" />
          </button>
        </div>

        {/* ── Crop canvas ── */}
        <div className="relative bg-[#141416]" style={{ height: "340px" }}>
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropAreaChange}
            classes={{
              containerClassName: "bg-[#141416]",
            }}
          />
        </div>

        {/* ── Controls ── */}
        <div className="px-6 py-5 space-y-5 border-t border-[#2E2E33]">
          {/* Zoom */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8E8E93]">
                Zoom
              </span>
              <span className="text-xs font-semibold text-[#C7C7CC] tabular-nums">
                {Math.round(zoom * 100)}%
              </span>
            </div>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.05}
              aria-label="Zoom"
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full h-[3px] bg-[#2A2A2E] rounded-full appearance-none cursor-pointer accent-[#A8821F]"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={onCancel}
              className="flex-1 h-11 text-sm"
            >
              Cancel
            </Button>

            {/* Use leftIcon prop so the icon renders outside the children <span> */}
            <Button
              leftIcon={<Check />}
              onClick={handleCrop}
              disabled={isApplying}
              className="flex-1 h-11 text-sm font-semibold"
            >
              {isApplying ? "Applying…" : "Apply"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
