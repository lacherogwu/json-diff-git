# JSON Diff Git

This is a simple tool to compare two JSON objects and generate a diff in a format that similar to git diff.

## Installation

```bash
npm install json-diff-git
```

## Usage

```typescript
import { diffToJson } from 'json-diff-git';

const before = { a: 1, b: 2, c: 3 };
const after = { a: 1, b: 3, d: 4 };

const result = await diffToJson(before, after);
consle.log(result);
```

Output

```json
{
  "a": 1,
  - "b": 2,
  + "b": 3,
  - "c": 3,
  + "d": 4
}
```

use `diffToHtml()` to generate a HTML diff with syntax highlighting.

or use `diff()` to get a list of changes.
