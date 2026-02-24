"use client";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ImageCropper } from "@/components/ui/image-cropper";
import { useOnboardingStore } from "../store";
import { Building, Camera, Shop } from "iconoir-react";
import { organizationRegisterPayloadSchema } from "@/services/organizations/types";
import { useMemo, useState } from "react";

const INDUSTRY_OPTIONS = [
  { value: "RESTAURANT", label: "Restaurant" },
  { value: "HOTEL", label: "Hotel" },
  { value: "BAKERY", label: "Bakery" },
  { value: "CLOUD_KITCHEN", label: "Cloud Kitchen" },
  { value: "CATERING", label: "Catering" },
  { value: "INSTITUTIONAL", label: "Institutional Kitchen" },
];

export function IdentityStep() {
  const { formData, updateData, nextStep, logoPreviewUrl, setLogoPreviewUrl } =
    useOnboardingStore();

  // The raw data URL of the selected image, pending crop
  const [imagePendingCrop, setImagePendingCrop] = useState<string | null>(null);

  const errors = useMemo(() => {
    const result = organizationRegisterPayloadSchema.safeParse(formData);
    if (result.success) return {};
    return result.error.issues.reduce((acc: any, issue) => {
      acc[issue.path[0] as string] = issue.message;
      return acc;
    }, {});
  }, [formData]);

  const isValid = !errors.name && !!formData.business_type;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Read as data URL to pass into the cropper
    const reader = new FileReader();
    reader.onload = () => {
      setImagePendingCrop(reader.result as string);
    };
    reader.readAsDataURL(file);
    // Reset so the same file can be re-selected later
    e.target.value = "";
  }

  function handleCropComplete(croppedBlob: Blob) {
    // Convert Blob → File so it fits the form schema
    const file = new File([croppedBlob], "logo.jpg", { type: "image/jpeg" });
    // Revoke any previous object URL to prevent memory leaks
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    // Store the URL in the Zustand store so the review step can read it without re-creating it
    const previewUrl = URL.createObjectURL(file);
    setLogoPreviewUrl(previewUrl);
    updateData({ logo: file });
    setImagePendingCrop(null);
  }

  function handleCropCancel() {
    setImagePendingCrop(null);
  }

  return (
    <>
      {/* Cropper modal – rendered outside the form flow so it overlays everything */}
      {imagePendingCrop && (
        <ImageCropper
          image={imagePendingCrop}
          aspect={1} // square
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}

      <div className="space-y-12 animate-fade-in">
        <div className="space-y-3">
          <h2 className="font-display text-4xl font-semibold tracking-tight text-text-primary">
            First, the basics.
          </h2>
          <p className="text-xl text-text-secondary max-w-lg leading-relaxed">
            Give your workspace a name and tell us which industry you operate
            in.
          </p>
        </div>

        <div className="space-y-10">
          {/* Logo upload */}
          <div className="flex flex-col items-center gap-4 pb-4">
            <div className="relative group">
              <div
                className={`h-28 w-28 rounded-2xl border-2 border-dashed flex items-center justify-center transition-all overflow-hidden ${
                  logoPreviewUrl
                    ? "border-brand-gold bg-brand-gold/5"
                    : "border-border-default hover:border-brand-gold/50 bg-surface-2"
                }`}
              >
                {logoPreviewUrl ? (
                  <img
                    src={logoPreviewUrl}
                    alt="Organization Logo"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Building className="h-9 w-9 text-text-muted group-hover:text-brand-gold/60 transition-colors" />
                )}
              </div>

              {/* Camera badge */}
              <label
                htmlFor="logo-upload"
                className="absolute -bottom-2 -right-2 h-9 w-9 rounded-full bg-brand-gold text-surface-1 flex items-center justify-center cursor-pointer shadow-level-2 hover:scale-110 transition-transform"
                title="Upload logo"
              >
                <Camera className="h-4 w-4" />
                <input
                  id="logo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            </div>

            <p className="text-sm font-medium text-text-muted">
              {logoPreviewUrl
                ? "Logo saved — click to change"
                : "Upload organization logo (optional)"}
            </p>
          </div>

          {/* Text fields */}
          <div className="grid grid-cols-1 gap-8">
            <Input
              label="Organization Name"
              placeholder="e.g. Grand Plaza Kitchen"
              value={formData.name}
              onChange={(e) => updateData({ name: e.target.value })}
              leadingIcon={<Building />}
              required
              error={formData.name.length > 0 ? errors.name : undefined}
              className="text-lg"
            />

            <Select
              label="Business Type"
              options={INDUSTRY_OPTIONS}
              value={formData.business_type}
              onChange={(val) =>
                updateData({
                  business_type: val as any,
                  industry_type: val as any,
                })
              }
              leadingIcon={<Shop />}
              placeholder="Select your industry"
              error={errors.business_type}
              className="text-lg"
            />
          </div>
        </div>

        <div className="flex justify-start pt-8">
          <Button
            onClick={nextStep}
            disabled={!isValid}
            className="px-12 py-7 text-base font-semibold shadow-level-2 transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Begin Setup
          </Button>
        </div>
      </div>
    </>
  );
}
