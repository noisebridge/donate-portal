// @ts-check
/// <reference types="bun-types" />
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "bun:test";
import { Window } from "happy-dom";

/** @type {Window} */
let happyWindow;
/** @type {Document} */
let doc;
/** @type {HTMLAnchorElement[]} */
let clickedAnchors;
/** @type {any} */
let getContext;
/** @type {any} */
let canvasContext;
/** @type {HTMLImageElement[]} */
let createdImages;

const DONATION_URL = "https://donate.example.com/qr";

beforeAll(async () => {
  happyWindow = new Window({ url: "https://donate.example.com/qr-editor" });
  doc = /** @type {Document} */ (/** @type {unknown} */ (happyWindow.document));
  /** @type {any} */ (globalThis).window = happyWindow;
  /** @type {any} */ (globalThis).document = doc;

  // happy-dom has no canvas backend and never loads image sources, so both are
  // stubbed. Downloads are captured by stubbing the anchor click the module
  // uses to hand the file to the browser.
  clickedAnchors = [];
  happyWindow.HTMLAnchorElement.prototype.click =
    /** @this {HTMLAnchorElement} */ function () {
      clickedAnchors.push(this);
    };

  canvasContext = { fillStyle: "", fillRect: jest.fn(), drawImage: jest.fn() };
  getContext = jest.fn(() => canvasContext);
  /** @type {any} */ (happyWindow.HTMLCanvasElement.prototype).getContext =
    getContext;
  /** @type {any} */ (happyWindow.HTMLCanvasElement.prototype).toDataURL = () =>
    "data:image/png;base64,AAAA";

  createdImages = [];
  /** @type {any} */ (globalThis).Image = function Image() {
    const image = /** @type {HTMLImageElement} */ (doc.createElement("img"));
    createdImages.push(image);
    return image;
  };

  // The page module registers its DOMContentLoaded handler as it is evaluated.
  await import("./qr-editor.mjs");
});

afterAll(async () => {
  delete (/** @type {any} */ (globalThis).window);
  delete (/** @type {any} */ (globalThis).document);
  delete (/** @type {any} */ (globalThis).Image);
  await happyWindow.happyDOM.close();
});

beforeEach(() => {
  clickedAnchors = [];
  getContext.mockReturnValue(canvasContext);
  createdImages = [];
});

/**
 * @param {object} [options]
 * @param {string} [options.min]
 * @returns {string}
 */
function editorPage(options = {}) {
  return `
    <form action="/qr.svg" method="get">
      <input type="text" id="amount" data-min="${options.min ?? "1"}" value="" />
      <input type="text" id="name" value="" />
      <input type="text" id="description" value="" />
      <input type="checkbox" id="use-logo" />
    </form>
    <input type="text" id="qr-url" value="${DONATION_URL}?amount=5" />
    <img id="qr-image" hidden alt="QR code" />
    <div id="qr-placeholder"></div>
    <button type="button" id="download-png">PNG</button>
    <button type="button" id="download-svg">SVG</button>`;
}

/** @param {object} [options] */
function loadPage(options = {}) {
  doc.body.innerHTML = editorPage(options);
  doc.dispatchEvent(
    /** @type {Event} */ (
      /** @type {unknown} */ (new happyWindow.Event("DOMContentLoaded"))
    ),
  );
}

/**
 * @param {string} id
 * @returns {HTMLInputElement}
 */
function input(id) {
  return /** @type {HTMLInputElement} */ (doc.getElementById(id));
}

/** @returns {HTMLImageElement} */
function qrImage() {
  return /** @type {HTMLImageElement} */ (doc.getElementById("qr-image"));
}

/**
 * @param {HTMLElement} el
 * @param {string} type
 */
function fire(el, type) {
  el.dispatchEvent(
    /** @type {Event} */ (
      /** @type {unknown} */ (new happyWindow.Event(type, { bubbles: true }))
    ),
  );
}

/**
 * @param {string} id
 * @param {string} value
 */
function typeInto(id, value) {
  input(id).value = value;
  fire(input(id), "input");
}

describe("updating the QR code", () => {
  beforeEach(() => {
    loadPage();
  });

  it("keeps the placeholder while the amount is empty", () => {
    typeInto("amount", "");

    expect(qrImage().hidden).toBe(true);
    expect(doc.getElementById("qr-placeholder")?.hidden).toBe(false);
    expect(input("qr-url").value).toBe(DONATION_URL);
  });

  it("keeps the placeholder while the amount is below the minimum", () => {
    typeInto("amount", "0.5");

    expect(qrImage().hidden).toBe(true);
  });

  it("renders the code and the shareable URL for a valid amount", () => {
    typeInto("amount", "25");

    expect(qrImage().hidden).toBe(false);
    expect(doc.getElementById("qr-placeholder")?.hidden).toBe(true);
    expect(qrImage().src).toContain("/qr.svg?amount=25&use-logo=false");
    expect(input("qr-url").value).toBe(`${DONATION_URL}?amount=25`);
  });

  it("includes the name and description once they are filled in", () => {
    typeInto("amount", "25");
    typeInto("name", "Laser Fund");
    typeInto("description", "For the cutter");

    expect(input("qr-url").value).toBe(
      `${DONATION_URL}?amount=25&name=Laser+Fund&description=For+the+cutter`,
    );
  });

  it("asks for the logo variant when the checkbox is ticked", () => {
    typeInto("amount", "25");
    input("use-logo").checked = true;
    fire(input("use-logo"), "change");

    expect(qrImage().src).toContain("use-logo=true");
    expect(input("qr-url").value).not.toContain("use-logo");
  });
});

describe("an unusable data-min", () => {
  it("is reported and stops the update", () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    loadPage({ min: "not-a-number" });

    typeInto("amount", "25");

    expect(error).toHaveBeenCalled();
    expect(qrImage().hidden).toBe(true);
    error.mockRestore();
  });
});

describe("downloads", () => {
  beforeEach(() => {
    loadPage();
  });

  it("are refused while no code has been rendered", () => {
    input("download-svg").click();
    input("download-png").click();

    expect(clickedAnchors).toHaveLength(0);
  });

  it("save the SVG under a slug of the name", () => {
    typeInto("amount", "25");
    typeInto("name", "Laser Fund!");

    input("download-svg").click();

    expect(clickedAnchors).toHaveLength(1);
    expect(lastAnchor().download).toBe("qr-code-laser-fund-.svg");
    expect(lastAnchor().href).toBe(qrImage().src);
  });

  it("fall back to a generic SVG name when no name is set", () => {
    typeInto("amount", "25");

    input("download-svg").click();

    expect(lastAnchor().download).toBe("qr-code-donation.svg");
  });

  it("rasterise the PNG once the image has loaded", () => {
    typeInto("amount", "25");
    typeInto("name", "Laser Fund");

    input("download-png").click();
    expect(clickedAnchors).toHaveLength(0);

    const temp = /** @type {any} */ (createdImages[0]);
    expect(temp.src).toBe(qrImage().src);
    temp.onload();

    expect(canvasContext.fillRect).toHaveBeenCalledWith(0, 0, 512, 512);
    expect(canvasContext.drawImage).toHaveBeenCalledWith(temp, 0, 0, 512, 512);
    expect(lastAnchor().download).toBe("qr-code-laser-fund.png");
    expect(lastAnchor().href).toBe("data:image/png;base64,AAAA");
  });

  it("give up on the PNG when no 2d context is available", () => {
    getContext.mockReturnValue(null);
    typeInto("amount", "25");

    input("download-png").click();

    expect(createdImages).toHaveLength(0);
    expect(clickedAnchors).toHaveLength(0);
  });
});

/**
 * The anchor the module created for the most recent download.
 * @returns {HTMLAnchorElement}
 */
function lastAnchor() {
  return /** @type {HTMLAnchorElement} */ (
    clickedAnchors[clickedAnchors.length - 1]
  );
}
