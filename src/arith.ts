import { parseArith } from "./tiny-ts-parser.ts";

type Type = 
    | { tag: "Boolean" }
    | { tag: "Number" }

type Term =
    | { tag: "true" }
    | { tag: "false"}
    | { tag: "if", cond: Term, thn: Term, els: Term }
    | { tag: "number"; n: number }
    | { tag: "add", left: Term, right: Term }

