import { defineParameters } from "@keynes/policy";
import { zodParameter } from "@keynes/policy/zod";
import { z } from "zod";

const declaration = defineParameters({
  orderLimit: zodParameter(z.number().int().nonnegative(), 3),
});
if (declaration.initials.orderLimit !== 3)
  throw new Error("Optional Zod export did not create a parameter");
