/*
  The conveyor as a tag, so a page can ask for the drawing without hydrating a
  framework component to hold an empty div. `connectedCallback` and
  `disconnectedCallback` are the mount and unmount the scene already wanted; a
  React island around them was one more lifecycle to keep in step.

  Registering the tag is a page's job, not a component's: `pages/index.astro`
  imports this module in a `<script>`. It cannot be imported from the section
  that uses the tag — that section is server-rendered and never hydrated, so the
  import would run at build time and never reach the browser at all.

  three and the scene are pulled in on connect rather than imported at the top,
  so neither is in the bundle the page first parses. Keep it that way: the
  import being asynchronous is what makes a disconnect before it settles free,
  since there is nothing built yet to throw away.
*/
export class ConveyorBelt extends HTMLElement {
  #conveyor;
  // Which connection a pending import belongs to. `disconnectedCallback` runs
  // synchronously inside `removeChild`, so an import can always still be in
  // flight when the element is taken out — and unlike a React effect the same
  // element can be put straight back, leaving two imports racing. A flag reset
  // on connect would let the stale one win; a token it can compare itself
  // against cannot be mistaken for the live one.
  #connection;

  connectedCallback() {
    if (this.#conveyor || this.#connection) return;
    const connection = {};
    this.#connection = connection;
    void import("./main.js").then(({ createConveyor }) => {
      if (this.#connection !== connection) return;
      this.#conveyor = createConveyor(this);
    });
  }

  disconnectedCallback() {
    this.#connection = undefined;
    this.#conveyor?.destroy();
    this.#conveyor = undefined;
  }
}

customElements.define("conveyor-belt", ConveyorBelt);
