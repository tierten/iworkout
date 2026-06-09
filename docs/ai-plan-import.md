# Import an AI-generated workout plan

This app can import a workout plan that an AI assistant (e.g. Claude) generates
from your **Health Connect** history. The flow is:

1. Your AI assistant reads your Health Connect workout data and designs a plan.
2. It outputs the plan as a single **plan code** (a `LLPLAN1:` token).
3. In the app, open **Settings → Import AI plan** (or the paste icon on the
   **Plans** screen), paste the code, **Preview**, and **Save plan**.

The imported plan becomes a normal program — fully editable afterwards.

---

## Plan code format

```
LLPLAN1:<base64 of the UTF-8 JSON described below>
```

- The `LLPLAN1:` prefix is recommended but optional — a bare base64 string, or
  even raw JSON (`{ … }`), is also accepted.
- Whitespace and line breaks inside the code are ignored.

## JSON schema

```jsonc
{
  "name": "string",            // program name (required)
  "description": "string",     // shown in the preview (optional)
  "sessions": [                // one or more workouts (required, non-empty)
    {
      "name": "string",        // workout name, e.g. "Push Day" (required)
      "notes": "string",       // optional
      "exercises": [           // required (may be empty)

        // --- WEIGHTED exercise: identified by the presence of "repsPerSet" ---
        {
          "name": "string",                 // required
          "sets": 3,                         // number, required
          "repsPerSet": 10,                  // number, required
          "weightIncreaseOnSuccess": 2.5,    // number, optional (default 0)
          "supersetWithNext": false,         // optional (default false)
          "notes": "string",                 // optional
          "link": "string",                  // optional URL
          "restBetweenSets": {               // optional (defaults to ~90s–180s)
            "minRest": "00:01:30",           // duration strings — see below
            "maxRest": "00:03:00",
            "failureRest": "00:05:00"
          }
        },

        // --- CARDIO exercise: no "repsPerSet"; "sets" is an array ---
        {
          "name": "string",                  // required
          "notes": "string",                 // optional
          "link": "string",                  // optional
          "sets": [
            {
              // target is either time OR distance:
              "target": { "type": "time", "value": "00:30:00" },
              // or:    { "type": "distance", "value": { "value": 5, "unit": "kilometre" } },
              "trackDistance": true,
              "trackDuration": true,
              "trackIncline": false,
              "trackResistance": false,
              "trackWeight": false,
              "trackSteps": false
            }
          ]
        }
      ]
    }
  ]
}
```

### Field rules

| Field | Type | Notes |
|---|---|---|
| `repsPerSet` | number | **Discriminator**: present → weighted; absent → cardio. |
| `sets` (weighted) | number | Number of sets. |
| `sets` (cardio) | array | One entry per cardio set. |
| `weightIncreaseOnSuccess` | number | Plain number (e.g. `2.5`), in the user's unit. |
| `target.type` | `"time"` \| `"distance"` | |
| distance `unit` | enum | One of `metre`, `yard`, `mile`, `kilometre`. |

### Duration format ⚠️

Durations (`minRest`, `maxRest`, `failureRest`, and a cardio `time` target's
`value`) are **C# `TimeSpan` strings**, *not* ISO-8601:

```
HH:MM:SS            e.g. "00:01:30" = 1 min 30 sec, "00:30:00" = 30 min
d.HH:MM:SS          (optional leading days)  e.g. "1.02:00:00" = 26 hours
```

`PT1M30S` is **invalid** and will be rejected.

---

## Worked example

The JSON above, for a 2-day plan, encodes to this plan code (you can paste it
into the app right now to test):

```
LLPLAN1:eyJuYW1lIjoiQUkgU3RhcnRlciBQbGFuIiwiZGVzY3JpcHRpb24iOiJBIDItZGF5IGZ1bGwtYm9keSArIGNhcmRpbyB3ZWVrIGdlbmVyYXRlZCBmcm9tIHlvdXIgSGVhbHRoIENvbm5lY3QgaGlzdG9yeS4iLCJzZXNzaW9ucyI6W3sibmFtZSI6IkZ1bGwgQm9keSBBIiwibm90ZXMiOiJJbmNyZWFzZSB3ZWlnaHQgd2hlbiBhbGwgc2V0cyBoaXQgdGhlIHRvcCBvZiB0aGUgcmVwIHJhbmdlLiIsImV4ZXJjaXNlcyI6W3sibmFtZSI6IkJhcmJlbGwgU3F1YXQiLCJzZXRzIjozLCJyZXBzUGVyU2V0Ijo1LCJ3ZWlnaHRJbmNyZWFzZU9uU3VjY2VzcyI6Mi41LCJzdXBlcnNldFdpdGhOZXh0IjpmYWxzZSwibm90ZXMiOiIiLCJsaW5rIjoiIiwicmVzdEJldHdlZW5TZXRzIjp7Im1pblJlc3QiOiIwMDowMzowMCIsIm1heFJlc3QiOiIwMDowNTowMCIsImZhaWx1cmVSZXN0IjoiMDA6MDg6MDAifX0seyJuYW1lIjoiQmVuY2ggUHJlc3MiLCJzZXRzIjozLCJyZXBzUGVyU2V0Ijo1LCJ3ZWlnaHRJbmNyZWFzZU9uU3VjY2VzcyI6Mi41LCJzdXBlcnNldFdpdGhOZXh0IjpmYWxzZSwibm90ZXMiOiIiLCJsaW5rIjoiIiwicmVzdEJldHdlZW5TZXRzIjp7Im1pblJlc3QiOiIwMDowMTozMCIsIm1heFJlc3QiOiIwMDowMzowMCIsImZhaWx1cmVSZXN0IjoiMDA6MDU6MDAifX0seyJuYW1lIjoiQmFyYmVsbCBSb3ciLCJzZXRzIjozLCJyZXBzUGVyU2V0Ijo4LCJ3ZWlnaHRJbmNyZWFzZU9uU3VjY2VzcyI6Mi41LCJzdXBlcnNldFdpdGhOZXh0IjpmYWxzZSwibm90ZXMiOiIiLCJsaW5rIjoiIiwicmVzdEJldHdlZW5TZXRzIjp7Im1pblJlc3QiOiIwMDowMTozMCIsIm1heFJlc3QiOiIwMDowMzowMCIsImZhaWx1cmVSZXN0IjoiMDA6MDU6MDAifX1dfSx7Im5hbWUiOiJab25lIDIgQ2FyZGlvIiwibm90ZXMiOiJLZWVwIGhlYXJ0IHJhdGUgaW4gem9uZSAyLiIsImV4ZXJjaXNlcyI6W3sibmFtZSI6IlRyZWFkbWlsbCIsIm5vdGVzIjoiIiwibGluayI6IiIsInNldHMiOlt7InRhcmdldCI6eyJ0eXBlIjoidGltZSIsInZhbHVlIjoiMDA6MzA6MDAifSwidHJhY2tEaXN0YW5jZSI6dHJ1ZSwidHJhY2tEdXJhdGlvbiI6dHJ1ZSwidHJhY2tJbmNsaW5lIjpmYWxzZSwidHJhY2tSZXNpc3RhbmNlIjpmYWxzZSwidHJhY2tXZWlnaHQiOmZhbHNlLCJ0cmFja1N0ZXBzIjpmYWxzZX1dfV19XX0=
```

---

## Prompt to give your AI assistant

> Read my **Health Connect** workout history (exercise sessions, frequency,
> recent lifts and cardio). Design a balanced weekly workout plan tailored to
> that history and my goals.
>
> Output **only** a single plan code in the LiftLog import format: the string
> `LLPLAN1:` followed by base64 of the UTF-8 JSON. The JSON must match this
> schema exactly:
>
> - Top level: `{ "name", "description", "sessions": [...] }`.
> - Each session: `{ "name", "notes", "exercises": [...] }`.
> - **Weighted** exercise (must include `repsPerSet`):
>   `{ "name", "sets": <number>, "repsPerSet": <number>,
>   "weightIncreaseOnSuccess": <number>, "supersetWithNext": <bool>,
>   "notes", "link", "restBetweenSets": { "minRest", "maxRest", "failureRest" } }`.
> - **Cardio** exercise (no `repsPerSet`; `sets` is an array):
>   each set is `{ "target", "trackDistance", "trackDuration", "trackIncline",
>   "trackResistance", "trackWeight", "trackSteps" }`, where `target` is
>   `{ "type": "time", "value": "HH:MM:SS" }` or
>   `{ "type": "distance", "value": { "value": <number>, "unit": "kilometre" } }`.
> - All durations use the C# `TimeSpan` format `HH:MM:SS` (e.g. `"00:01:30"`),
>   **never** ISO-8601.
> - Distance `unit` is one of `metre`, `yard`, `mile`, `kilometre`.
>
> Return just the `LLPLAN1:` token, nothing else.

---

## Notes for maintainers

- The decode/validate/convert logic lives in
  [`app/src/plugins/ai-plan-import/parse.ts`](../app/src/plugins/ai-plan-import/parse.ts).
  Its JSON→domain conversion mirrors `toAiWorkoutPlan` / `parseAiExercise` in
  [`app/src/services/ai-chat-service.ts`](../app/src/services/ai-chat-service.ts)
  (the built-in AI planner) and must be kept in sync if that plan shape changes.
- The duration grammar is defined by `parseDuration` in
  [`app/src/utils/format-date.ts`](../app/src/utils/format-date.ts).
