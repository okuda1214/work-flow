# Security Specification & "Dirty Dozen" Payloads

## 1. Data Invariants
- Each user can only read, write, update, or delete their own documents (where `resource.data.userId == request.auth.uid` or `request.resource.data.userId == request.auth.uid`).
- Non-authenticated requests are blocked from all reads and writes.
- Key properties like `id`, `userId`, and `createdAt`/`date` must remain unchanged on updates.
- All IDs (`taskId`, `recordId`, `eventId`) must be validated against path poisoning.

## 2. The "Dirty Dozen" Malicious Payloads

### Test 1: Task - Owner Spoofing on Create
An attacker tries to create a task for another user:
```json
{
  "id": "task-attack-1",
  "title": "Malicious Task",
  "priority": "high",
  "estimatedMinutes": 10,
  "category": "work",
  "status": "not_started",
  "createdAt": 1718000000000,
  "userId": "victim-user-id"
}
```
*Expected: PERMISSION_DENIED*

### Test 2: Task - Create without authentication
An unauthenticated request attempts to create a task:
```json
{
  "id": "task-attack-2",
  "title": "Spam Task",
  "priority": "low",
  "estimatedMinutes": 30,
  "category": "spam",
  "status": "not_started",
  "createdAt": 1718000000000,
  "userId": "some-uid"
}
```
*Expected: PERMISSION_DENIED*

### Test 3: Task - Poison ID Attack
An attacker tries to inject a huge string or invalid characters into the document ID `tasks/{taskId}`:
`tasks/$$$---poison-id-too-long-long-long-long-long-long-long-long-long-long-long-long-long-long-long-long-long-long`
```json
{
  "id": "poison-id",
  "title": "Valid Topic",
  "priority": "low",
  "estimatedMinutes": 15,
  "category": "work",
  "status": "not_started",
  "createdAt": 1718000050000,
  "userId": "attacker-uid"
}
```
*Expected: PERMISSION_DENIED*

### Test 4: Task - Invalid priority transition/type
An attacker tries to update or create a task with an unsupported priority:
```json
{
  "id": "task-attack-4",
  "title": "Bad Priority Task",
  "priority": "ultra-critical",
  "estimatedMinutes": 10,
  "category": "work",
  "status": "not_started",
  "createdAt": 1718000000000,
  "userId": "attacker-uid"
}
```
*Expected: PERMISSION_DENIED*

### Test 5: Task - Mutating userId on Update
An attacker tries to transfer ownership of their task to a victim:
```json
{
  "id": "task-attack-5",
  "userId": "victim-uid"
}
```
*Expected: PERMISSION_DENIED*

### Test 6: TaikinRecord - Owner Spoofing on Shift Creation
An attacker tries to submit an attendance sheet for another employee:
```json
{
  "id": "record-attack-6",
  "date": "2026-06-12",
  "clockIn": "09:00",
  "clockOut": "18:00",
  "workMinutes": 480,
  "overtimeMinutes": 0,
  "userId": "victim-uid"
}
```
*Expected: PERMISSION_DENIED*

### Test 7: TaikinRecord - Injecting Negative Work Minutes
An attacker tries to corrupt analytics with negative hours:
```json
{
  "id": "record-attack-7",
  "date": "2026-06-12",
  "clockIn": "09:00",
  "clockOut": "18:00",
  "workMinutes": -20,
  "overtimeMinutes": -10,
  "userId": "attacker-uid"
}
```
*Expected: PERMISSION_DENIED*

### Test 8: TaikinRecord - Updating Immutable Date
An attacker tries to change the date of an existing punch-in:
```json
{
  "id": "record-attack-8",
  "date": "1999-12-31"
}
```
*Expected: PERMISSION_DENIED*

### Test 9: CalendarEvent - Owner Spoofing
Writing local events to another user's stream:
```json
{
  "id": "event-9",
  "summary": "Meeting",
  "userId": "victim-uid",
  "start": { "dateTime": "2026-06-12T10:00:00Z" },
  "end": { "dateTime": "2026-06-12T11:00:00Z" }
}
```
*Expected: PERMISSION_DENIED*

### Test 10: CalendarEvent - Create without start time
Creating events lacking required temporal bounds:
```json
{
  "id": "event-10",
  "summary": "Empty Event",
  "userId": "attacker-uid"
}
```
*Expected: PERMISSION_DENIED*

### Test 11: General - Blanket read on all tasks
An authenticated user trying to read tasks of other users:
`allow list: if isSignedIn();` -> Exploit: `getDocs(collection(db, 'tasks'))`
*Expected: PERMISSION_DENIED (Must require query filter comparison on userId)*

### Test 12: General - Path variables spoofing
Attacking document path with injection chars `taikinRecords/{recordId}`:
`taikinRecords/abc%2Fdef`
*Expected: PERMISSION_DENIED*
