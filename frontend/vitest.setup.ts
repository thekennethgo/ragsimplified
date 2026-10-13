import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";

// Slow CI runners can exceed the 1000 ms default for findBy*/waitFor, so allow 3 s.
configure({ asyncUtilTimeout: 3000 });
