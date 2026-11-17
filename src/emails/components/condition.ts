/** A parsed MSO conditional-comment expression. */
export type Condition =
  | { kind: "test"; operator?: Comparison; feature: string; version?: number }
  | { kind: "not"; operand: Condition }
  | { kind: "and" | "or"; left: Condition; right: Condition };

type Comparison = "lt" | "lte" | "gt" | "gte";

const comparison = /^(lt|lte|gt|gte)$/i;

/** Parse `mso`, `lte mso 11`, `(gte mso 9)&(lt mso 12)` or `!mso`. */
export function parseCondition(source: string): Condition {
  const tokens = source.match(/\(|\)|&|\||!|[a-z]+|\d+/gi) ?? [];
  if (tokens.join("") !== source.replace(/\s+/g, "")) {
    throw new TypeError(`Invalid conditional expression: ${source}`);
  }

  let index = 0;
  const peek = () => tokens[index];
  const take = () => tokens[index++];

  const primary = (): Condition => {
    if (peek() === "(") {
      take();
      const inner = expression(0);
      if (take() !== ")") throw new TypeError(`Unclosed group: ${source}`);
      return inner;
    }
    const operator = comparison.test(peek() ?? "")
      ? (take()?.toLowerCase() as Comparison)
      : undefined;
    const feature = take();
    if (feature == null || !/^[a-z]+$/i.test(feature)) {
      throw new TypeError(`Expected a feature: ${source}`);
    }
    const version = /^\d+$/.test(peek() ?? "") ? Number(take()) : undefined;
    return {
      kind: "test",
      feature,
      ...(operator ? { operator } : {}),
      ...(version != null ? { version } : {}),
    };
  };

  const unary = (): Condition => {
    if (peek() !== "!") return primary();
    take();
    return { kind: "not", operand: unary() };
  };

  const expression = (min: number): Condition => {
    let left = unary();
    for (;;) {
      const operator = peek();
      const precedence =
        operator === "|" ? 1 : operator === "&" ? 2 : undefined;
      if (precedence == null || precedence < min) return left;
      take();
      left = {
        kind: operator === "&" ? "and" : "or",
        left,
        right: expression(precedence + 1),
      };
    }
  };

  const condition = expression(0);
  if (index !== tokens.length) {
    throw new TypeError(`Unexpected "${tokens[index]}": ${source}`);
  }
  return condition;
}
