declare module "qrcode-svg" {
  export interface QRCodeOptions {
    /** QR Code content */
    content: string;
    /**
     * White space padding in modules
     * @default 4
     */
    padding?: number;
    /**
     * QR Code width in pixels
     * @default 256
     */
    width?: number;
    /**
     * QR Code height in pixels
     * @default 256
     */
    height?: number;
    /**
     * Color of modules (squares), color name or hex string
     * @default "#000000"
     */
    color?: string;
    /**
     * Color of background, color name or hex string
     * @default "#ffffff"
     */
    background?: string;
    /**
     * Error correction level
     * @default "M"
     */
    ecl?: "L" | "M" | "Q" | "H";
    /**
     * Join modules (squares) into one shape, into the SVG path element.
     * Recommended for web and responsive use.
     * @default false
     */
    join?: boolean;
    /**
     * Create squares as pattern, then populate the canvas.
     * @default false
     */
    predefined?: boolean;
    /**
     * Apply indents and new lines.
     * @default true
     */
    pretty?: boolean;
    /**
     * Swap X and Y coordinates when rendering modules. This transposes the QR code
     * matrix, which can fix compatibility issues with certain QR code readers that
     * expect a different orientation.
     * @default false
     */
    swap?: boolean;
    /**
     * Prepend XML declaration to the SVG document.
     * @default true
     */
    xmlDeclaration?: boolean;
    /**
     * Wrapping element.
     * - "svg" - SVG document with width and height attribute (recommended for raster/PDF conversion)
     * - "svg-viewbox" - SVG document with viewBox attribute (recommended for responsive web pages)
     * - "g" - put squares in g element (useful for multiple QR codes in single SVG)
     * - "none" - no wrapper
     * @default "svg"
     */
    container?: "svg" | "svg-viewbox" | "g" | "none";
  }

  export interface SvgOptions {
    /**
     * Wrapping element.
     * - "svg" - SVG document with width and height attribute (recommended for raster/PDF conversion)
     * - "svg-viewbox" - SVG document with viewBox attribute (recommended for responsive web pages)
     * - "g" - put squares in g element (useful for multiple QR codes in single SVG)
     * - "none" - no wrapper
     * @default "svg"
     */
    container?: "svg" | "svg-viewbox" | "g" | "none";
  }

  /**
   * The internal QR code model containing the encoded data.
   *
   * A QR code is made up of a grid of "modules" - the small black and white
   * squares that form the pattern. Each module represents a single bit of data.
   * The modules array is a 2D grid where `true` represents a dark (black) module
   * and `false` represents a light (white) module.
   */
  export interface QRCodeModel {
    /**
     * 2D array of modules (the individual squares in a QR code).
     * Each boolean indicates whether the module is foreground (true) or
     * background (false). Access as modules[x][y].
     */
    modules: boolean[][];
    /** The number of modules along each side of the QR code grid */
    moduleCount: number;
  }

  class QRCode {
    options: Required<QRCodeOptions>;
    qrcode: QRCodeModel;

    /**
     * Create a new QRCode instance
     * @param options - QR Code options or content string
     */
    constructor(options: QRCodeOptions | string);

    /**
     * Generates QR Code as SVG image
     * @param opt - SVG generation options
     * @returns SVG string
     */
    svg(opt?: SvgOptions): string;

    /**
     * Writes QR Code image to a file (Node.js only)
     * @param file - Output file path
     * @param callback - Callback function
     */
    save(
      file: string,
      callback?: (error: Error | null, result?: unknown) => void,
    ): void;
  }

  export default QRCode;
}
