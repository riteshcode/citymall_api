import mongoose from 'mongoose';

/** Reusable { en, hi } embedded schema for every user-facing text field. */
export const bilingualSchema = new mongoose.Schema(
  {
    en: { type: String, required: true, trim: true },
    hi: { type: String, required: true, trim: true },
  },
  { _id: false }
);
