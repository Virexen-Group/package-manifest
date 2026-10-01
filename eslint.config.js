import parser from "@typescript-eslint/parser";
export default [{ignores:["dist/**","node_modules/**"]},{files:["**/*.ts"],languageOptions:{parser},rules:{semi:["error","always"],quotes:["error","double"],"no-unused-vars":"off"}}];
