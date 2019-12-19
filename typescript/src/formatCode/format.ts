import phpPlugin from "@prettier/plugin-php/standalone";
import * as prettier from "prettier";
import { getOps } from "./utils";
export const formatPHP = (source) => {
  const options = getOps('php');
  return prettier.format(source, {
    plugins: [phpPlugin],
    parser: 'php',
  ...options
  });
}
