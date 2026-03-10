"use client";

import { create } from "zustand";

type CSVUploadSessionState = {
  file: File | null;
  branchId: string;
  returnPath?: string;
  targetDate?: string;
  setSession: (payload: {
    file: File;
    branchId: string;
    returnPath?: string;
    targetDate?: string;
  }) => void;
  clearSession: () => void;
};

export const useCSVUploadSessionStore = create<CSVUploadSessionState>((set) => ({
  file: null,
  branchId: "",
  returnPath: undefined,
  targetDate: undefined,
  setSession: ({ file, branchId, returnPath, targetDate }) =>
    set({ file, branchId, returnPath, targetDate }),
  clearSession: () =>
    set({ file: null, branchId: "", returnPath: undefined, targetDate: undefined }),
}));
