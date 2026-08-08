import { createColors } from "picocolors";

export const pc = createColors(process.stdout.isTTY ?? false);
