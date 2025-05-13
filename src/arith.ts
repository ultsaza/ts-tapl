import { parseArith } from "./tiny-ts-parser.ts";

type Type =
  | { tag: "Boolean" }
  | { tag: "Number" };

type Term =
  | { tag: "true" }
  | { tag: "false" }
  | { tag: "if"; cond: Term; thn: Term; els: Term }
  | { tag: "number"; n: number }
  | { tag: "add"; left: Term; right: Term }
  | { tag: "var"; name: string }
  | { tag: "func"; params: Param[]; body: Term }
  | { tag: "call"; func: Term; args: Term[] }
  | { tag: "seq"; body: Term; rest: Term }
  | { tag: "const"; name: string; init: Term; rest: Term };

type Param = { name: string; type: Type };

function typecheck(t: Term): Type {
  switch (t.tag) {
    case "true":
      return { tag: "Boolean" };
    case "false":
      return { tag: "Boolean" };
    case "if": {
      const condType = typecheck(t.cond);
      const thnType = typecheck(t.thn);
      const elsType = typecheck(t.els);
      if (thnType !== elsType) throw "then and else must have the same type";
      return thnType;
    }
    case "number": {
      return { tag: "Number" };
    }
    case "add": {
      const leftType = typecheck(t.left);
      if (leftType.tag !== "Number") throw "number expected";
      const rightType = typecheck(t.right);
      if (rightType.tag !== "Number") throw "number expected";
      return { tag: "Number" };
    }
  }
}
