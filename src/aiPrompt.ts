export const AI_PLAN_PROMPT = `Create a combined running and strength training plan for me.

My goal:
[DESCRIBE YOUR GOAL]

Plan length:
[NUMBER OF WEEKS]

Weekly availability and preferences:
[LIST AVAILABLE DAYS, LONG-RUN DAY, STRENGTH DAYS, EQUIPMENT, CURRENT FITNESS, INJURIES, AND OTHER CONSTRAINTS]

Return only valid JSON. Do not use Markdown fences or add commentary. Follow this exact structure:
{
  "schemaVersion": 1,
  "title": "Plan name",
  "description": "Short plan overview",
  "guidance": ["General instruction", "Another instruction"],
  "weeks": [
    {
      "weekNumber": 1,
      "summary": "Optional focus for this week",
      "workouts": [
        {
          "day": "mon",
          "type": "running",
          "title": "Easy run",
          "instructions": "Conversational effort",
          "plannedMiles": 4
        },
        {
          "day": "mon",
          "type": "strength",
          "title": "Legs and core",
          "instructions": "Keep two reps in reserve",
          "plannedMinutes": 45,
          "exercises": [
            { "name": "Bulgarian split squat", "prescription": "3 x 8-12 / leg" }
          ]
        }
      ]
    }
  ]
}

Rules:
- Use lowercase three-letter weekdays: mon, tue, wed, thu, fri, sat, sun.
- Workout type must be running, strength, mobility, cross_training, or other.
- Include every week, numbered consecutively from 1.
- A day may contain multiple workouts.
- Running workouts must include plannedMiles or plannedMinutes.
- Strength exercises use name and prescription strings.
- Do not include IDs, dates, completion state, or notes; the app adds those.`;
