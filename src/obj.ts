import { parseArith, parseBasic, error, parseObj, parseRecFunc } from "./tiny-ts-parser.ts";

type Type =
  | { tag: "Boolean" }
  | { tag: "Number" }
  | { tag: "Func"; params: Param[]; retType: Type}
  | { tag: "Object"; props: PropertyType[] };
 
type Term =
  | { tag: "true" }
  | { tag: "false" }
  | { tag: "if"; cond: Term; thn: Term; els: Term }
  | { tag: "number"; n: number }
  | { tag: "add"; left: Term; right: Term }
  | { tag: "var"; name: string }
  | { tag: "func"; params: Param[]; retType: Type; body: Term }
  | { tag: "call"; func: Term; args: Term[] }
  | { tag: "seq"; body: Term; rest: Term }
  | { tag: "const"; name: string; init: Term; rest: Term }
  | { tag: "objectNew"; props: PropertyTerm[] }
  | { tag: "objectGet"; obj: Term; propName: string }
  | { 
      tag: "recFunc";
      funcName: string;
      params: Param[];
      retType: Type;
      body: Term;
      rest: Term;
  };

type Param = { name: string; type: Type };
type TypeEnv = Record<string, Type>;
type PropertyTerm = { name: string; term: Term };
type PropertyType = { name: string; type: Type };

function typecheck(t: Term, tyEnv: TypeEnv): Type {
  switch (t.tag) {
    case "true":
      return { tag: "Boolean" };
    case "false":
      return { tag: "Boolean" };
    case "if": {
      const condType = typecheck(t.cond, tyEnv);
      if (condType.tag !== "Boolean") throw "boolean expected";
      const thnType = typecheck(t.thn, tyEnv);
      const elsType = typecheck(t.els, tyEnv);
      if (!typeEq(thnType, elsType)) throw "then and else must have the same type";
      return thnType;
    }
    case "number": {
      return { tag: "Number" };
    }
    case "add": {
      const leftType = typecheck(t.left, tyEnv);
      if (leftType.tag !== "Number") throw "number expected";
      const rightType = typecheck(t.right, tyEnv);
      if (rightType.tag !== "Number") throw "number expected";
      return { tag: "Number" };
    }
    case "var": {
        if (tyEnv[t.name] === undefined) throw new Error(`undefined variable: ${t.name}`);
        return tyEnv[t.name];
    }
    case "func": {
        const newTyEnv = { ...tyEnv };
        for (const { name, type } of t.params) {
            newTyEnv[name] = type;
        }
        const retTy = typecheck(t.body, newTyEnv);
        if (t.retType) {
          if (!typeEq(retTy, t.retType)) throw `return type mismatch`;
        }
        return { tag: "Func", params: t.params, retType: t.retType };
    }
    case "recFunc": {
      const funcTy: Type = {
        tag: "Func",
        params: t.params,
        retType: t.retType
      };
      const newTyEnv = { ...tyEnv };
      for (const { name, type } of t.params) {
          newTyEnv[name] = type;
      }
      newTyEnv[t.funcName] = funcTy;
      const retType = typecheck(t.body, newTyEnv);
      if (!typeEq(t.retType, retType)) error("wrong return type", t);
      const tyEnvAddRecFunc = { ...tyEnv,  [t.funcName]: funcTy}; // 仮引数を含まない, 定義された関数のみを追加した型環境.
      return typecheck(t.rest, tyEnvAddRecFunc);
    }
    case "call": {
        const funcTy = typecheck(t.func, tyEnv);
        if (funcTy.tag !== "Func") throw "function expected";
        if (funcTy.params.length !== t.args.length) throw "wrong number of arguments";
        for (let i = 0; i < t.args.length; i++) {
            const argTy = typecheck(t.args[i], tyEnv);
            if (!typeEq(funcTy.params[i].type, argTy)) throw "argument type mismatch";
        }
        return funcTy.retType;
    }
    case "seq": {
        typecheck(t.body, tyEnv);
        return typecheck(t.rest, tyEnv);
    }
    case "const": {
      if (t.init.tag === "func") {
        if(!t.init.retType) error("return type is required for function", t.init);
        const funcTy: Type = {
          tag: "Func",
          params: t.init.params,
          retType: t.init.retType
        };
        const newTyEnv = { ...tyEnv };
        for (const { name, type } of t.init.params) {
          newTyEnv[name] = type;
        }
        const tyEnvAddRecfunc = { ...tyEnv, [t.name]: funcTy };
        if (!typeEq(t.init.retType, typecheck(t.rest, tyEnvAddRecfunc))) error("wrong return type", t);
        return typecheck(t.rest, tyEnvAddRecfunc);
      } else {
          const ty = typecheck(t.init, tyEnv);
          const newTyEnv = { ...tyEnv, [t.name]: ty };
          return typecheck(t.rest, newTyEnv);
      }
    }
    case "objectNew": {
        const props = t.props.map(
          ({name, term}) => ({name, type: typecheck(term, tyEnv)}),
        );
        return { tag: "Object", props };
    }
    case "objectGet": {
      const objTy = typecheck(t.obj, tyEnv);
      if (objTy.tag !== "Object") error ("object type expected", t.obj);
      const prop = objTy.props.find(p => p.name === t.propName);
      if (!prop) error("unknown property name: ${t.propName}", t);
      return prop.type;
    }

    default:
      throw new Error("not implemented yet");
  }
}

function typeEq(ty1: Type, ty2: Type): boolean {
    switch (ty2.tag) {
        case "Boolean":
            return ty1.tag === "Boolean";
        case "Number":
            return ty1.tag === "Number";
        case "Func": {
            if (ty1.tag !== "Func") return false;
            if (ty1.params.length !== ty2.params.length) return false;
            for (let i = 0; i < ty1.params.length; i++) {
                if (!typeEq(ty1.params[i].type, ty2.params[i].type)) return false;
            }
            if (!typeEq(ty1.retType, ty2.retType)) return false;
            return true
        }
        case "Object": {
          if (ty1.tag !== "Object") return false;
          if (ty1.props.length !== ty2.props.length) return false;
          for (const prop2 of ty2.props) {
            const prop1 = ty1.props.find(p => p.name === prop2.name);
            if (!prop1) return false;
            if (!typeEq(prop1.type, prop2.type)) return false;
          }
          return true;
        }
    }
}

function subtype(ty1: Type, ty2: Type): boolean {
  switch (ty2.tag) {
    case "Boolean":
      return ty1.tag === "Boolean";
    case "Number":
      return ty1.tag === "Number";
    case "Object": {
      if (ty1.tag !== "Object") return false;
      for (const prop2 of ty2.props) {
        const prop1 = ty1.props.find(p => p.name === prop2.name);
        if (!prop1) return false;
        if (!subtype(prop1.type, prop2.type)) return false;
      }
      return true;
    }
    case "Func": {
      if (ty1.tag !== "Func") return false;
      if (ty1.params.length !== ty2.params.length) return false;
      for (let i = 0; i < ty1.params.length; i++) {
        if (!subtype(ty2.params[i].type, ty1.params[i].type)) return false;
      }
      return subtype(ty1.retType, ty2.retType);
    }
  }
}