module.exports = {
  "parser": "babel-eslint",
  "extends" : [
    "standard",
    "plugin:promise/recommended"
  ],
  "plugins": [
    "promise",
    "flowtype"
  ],
  "env": {
    "browser" : true,
    "node"    : true,
    "mocha"   : true,
    "jest"    : true
  },
  "globals" : {
    "artifacts": false,
    "contract": false,
    "assert": false,
    "web3": false
  },
  "rules": {

    // Strict mode
    "strict": [2, "global"],

    // Code style
    "indent": [2, 2],
    "quotes": [2, "single"],
    "semi": ["error", "always"],
    "space-before-function-paren": ["error", "always"],
    "no-use-before-define": 0,
    "eqeqeq": [2, "smart"],
    "dot-notation": [2, {"allowKeywords": true, "allowPattern": ""}],
    "no-redeclare": [2, {"builtinGlobals": true}],
    "no-trailing-spaces": [2, { "skipBlankLines": true }],
    "eol-last": 1,
    "comma-spacing": [2, {"before": false, "after": true}],
    "camelcase": [2, {"properties": "always"}],
    "no-mixed-spaces-and-tabs": [2, "smart-tabs"],
    "comma-dangle": [1, "always-multiline"],
    "no-dupe-args": 2,
    "no-dupe-keys": 2,
    "no-debugger": 0,
    "no-undef": 2,
    "one-var": [0],
    "object-curly-spacing": [2, "always"],
    "generator-star-spacing": ["error", "before"],
    "promise/avoid-new": 0,
    "promise/always-return": 0,

    // Flow
    "flowtype/boolean-style": [
      2,
      "boolean"
    ],
    "flowtype/define-flow-type": 1,
    "flowtype/delimiter-dangle": [
      2,
      "never"
    ],
    "flowtype/generic-spacing": [
      2,
      "never"
    ],
    "flowtype/no-primitive-constructor-types": 2,
    "flowtype/no-types-missing-file-annotation": 2,
    "flowtype/no-weak-types": [2, {Object: false}],
    "flowtype/object-type-delimiter": [
      2,
      "comma"
    ],
    "flowtype/require-parameter-type": [
      2,
      {
        "excludeArrowFunctions": true
      }
    ],
    "flowtype/require-return-type": [
      2,
      "always",
      {
        "annotateUndefined": "never",
        "excludeArrowFunctions": true
      }
    ],
    "flowtype/require-valid-file-annotation": 2,
    "flowtype/semi": [
      2,
      "always"
    ],
    "flowtype/space-after-type-colon": [
      2,
      "always"
    ],
    "flowtype/space-before-generic-bracket": [
      2,
      "never"
    ],
    "flowtype/space-before-type-colon": [
      2,
      "never"
    ],
    "flowtype/type-id-match": [
      2,
      "^([A-Z][a-z0-9]+)+Type$"
    ],
    "flowtype/union-intersection-spacing": [
      2,
      "always"
    ],
    "flowtype/use-flow-type": 1,
    "flowtype/valid-syntax": 1
  },
  "settings": {
    "flowtype": {
      "onlyFilesWithFlowAnnotation": true
    }
  }
};
