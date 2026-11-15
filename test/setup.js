import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
if (typeof window !== "undefined") {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.scrollTo = () => {}; globalThis.scrollTo = () => {};
  window.confirm = () => true; window.alert = () => {}; window.prompt = () => "1234";
  Element.prototype.scrollIntoView = () => {};
  afterEach(() => cleanup());
}
