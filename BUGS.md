# Bug Report

## Pagination offset bug

### Bug summary
The pagination logic used an incorrect offset calculation:

- Incorrect: page * limit
- Correct: (page - 1) * limit

This caused the API to skip records when requesting later pages, especially affecting page 1 and page 2 behavior.

### How the bug was discovered
The bug was discovered during pagination integration testing. Our tests for `GET /tasks?page=2&limit=2` and the default pagination behavior failed because the API returned the wrong slice of tasks.

### Expected behavior
Page numbers are 1-based, so page 1 should start at offset 0. In other words:

- page 1 with limit 2 should return tasks 1-2
- page 2 with limit 2 should return tasks 3-4

### Actual behavior
Page 1 and subsequent pages were offset incorrectly, causing the API to skip the first `limit` records. For example, the first page did not start at the beginning of the dataset and page 2 returned incorrect results.

### Root cause
The pagination logic in the service layer used the wrong calculation when deriving the slice offset. Instead of converting the 1-based page number into a zero-based array offset, it multiplied by the limit directly.

### Fix
The offset calculation was corrected to:

```js
const offset = (page - 1) * limit;
```

This keeps the behavior consistent with standard 1-based pagination semantics while preserving the rest of the API contract.

### Verification
The full Jest suite was run after the fix and it passes:

- 2 test suites passed
- 32/32 tests passed

### Why this is a genuine bug
This is a real functional bug because it breaks the API contract for page-based queries. Users receive incorrect results for paginated requests, which means the underlying data is skipped and the pagination behavior is wrong even though the endpoint still responds successfully.

### Why the regression test matters
The regression test is important because it protects the expected paging behavior from being reintroduced later. Without a test covering the page offset math, a future refactor could easily re-break pagination without any obvious runtime error. The test ensures page 1 starts at offset 0 and later pages continue from the correct starting record.
