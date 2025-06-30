// codegen.ts
// Generate `graphql/generated/*.ts` file from "graphql/*.graphql".

import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  // Point to the schema file you downloaded
  schema: "schema.graphql",

  // Point to the files containing your GraphQL operations
  documents: "graphql/**/*.graphql",

  generates: {
    // Define the output path for the generated code
    "graphql/generated/graphql.ts": {
      plugins: [
        "typescript",
        "typescript-operations",
        "typescript-generic-sdk", // This plugin creates a typed SDK
      ],
      config: {
        // Optional: Prepend `I` to interfaces to distinguish them
        interfacePrefix: "I",
        // Optional: Make all generated properties readonly for immutability
        immutableTypes: true,
      },
    },
  },
};

export default config;
