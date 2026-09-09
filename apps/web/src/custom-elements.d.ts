/*
  Tags that are not HTML's and not a framework's. TypeScript knows nothing about
  an element the browser learns about at runtime, so each one is declared here
  for the TSX that uses it.

  Registering them is a page's job — see the `<script>` in `pages/index.astro`.
  A declaration here says only what the tag accepts, never that anything has
  defined it.
*/
import "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      // The conveyor drawing. See src/lib/conveyor/element.js.
      "conveyor-belt": HTMLAttributes<HTMLElement>;
    }
  }
}
