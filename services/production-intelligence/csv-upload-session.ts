"use client";

import { create } from "zustand";

type CSVUploadSessionState = {
  file: File | null;
  branchId: string;
  setSession: (payload: { file: File; branchId: string }) => void;
  clearSession: () => void;
};

export const useCSVUploadSessionStore = create<CSVUploadSessionState>((set) => ({
  file: null,
  branchId: "",
  setSession: ({ file, branchId }) => set({ file, branchId }),
  clearSession: () => set({ file: null, branchId: "" }),
}));

