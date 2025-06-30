GraphQL queries of Cloudflare GraphQL APIs:

- Cloudflare GraphQL Analytics API

## Generate schema.graphql

```
npm install -g get-graphql-schema
get-graphql-schema --header "Authorization=Bearer <token>" https://api.cloudflare.com/client/v4/graphql > schema.graphql
```

## Generate `./generated/*.ts` files

```
npm run codegen
```

It executes `graphql-codegen --config codegen.ts`.

## `.graphql` file extension support

Install VS Code extension [GraphQL.vscode-graphql](https://marketplace.visualstudio.com/items?itemName=GraphQL.vscode-graphql). It provides syntax highlighting, autocomplete suggestions, validation against schema and more.
