# OFFO Reddit Community Operator Tool

Internal tool for analyzing Reddit posts and generating on-brand OFFO-style replies.

## Key Principle

**Tool mention only when user expresses uncertainty or asks directly.**

This is a hard-coded rule. The tool will never suggest introducing OFFO unless:
1. User explicitly asks for a tool/checklist/link
2. User expresses uncertainty ("not sure", "should I", "worried", etc.)

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn main:app --reload --port 8088

# Or run directly
python main.py
```

## API Endpoints

### POST /analyze

Analyze a Reddit post and get a reply plan.

**Request:**
```json
{
  "source": "reddit",
  "subreddit": "ElectricVehicles",
  "thread_type": "first_ev",
  "region_hint": "US",
  "post_title": "Thinking about getting a Model 3",
  "post_body": "I live in an apartment with no home charging. Not sure if it will work for me. Any advice?",
  "top_comment_context": ["Most people say you need home charging..."]
}
```

**Response:**
```json
{
  "intent": "purchase_advice",
  "user_state": "uncertain",
  "ownership_phase": "buyer",
  "friction_tags": ["NO_HOME_CHARGING"],
  "reply_plan": {
    "validate_line": "Totally fair — public-charging setups can work...",
    "hidden_tradeoff_line": "The hidden tradeoff is that public charging can work...",
    "reframe_line": "This isn't really about range — it's about whether...",
    "reflective_question": "Do you have one reliable 'Plan B' location...",
    "tool_intro": "offer_by_permission"
  },
  "draft_reply_short": "...",
  "draft_reply_long": "...",
  "tool_blurb": "If you want, we built a quick EV routine sanity-check...",
  "safety_flags": []
}
```

### GET /health

Health check endpoint.

### GET /stats/recent?limit=20

Get recent analyses for review.

### GET /stats/tags

Get friction tag frequency across all analyses.

## Operator Workflow

1. **Copy** a Reddit post + 1–2 key comments
2. **POST** to `/analyze`
3. **Review** the response:
   - Check if `tool_intro` allows tool mention
   - Review `safety_flags` for conversation risks
   - Choose `draft_reply_short` or `draft_reply_long`
4. **Edit** if needed (preserve the tone)
5. **Post** to Reddit

## Classification Details

### Intent Types
- `purchase_advice` - Pre-purchase questions
- `ownership_support` - Existing owner seeking help
- `charging_question` - Charging-related questions
- `debate` - EV vs ICE debates (be careful)
- `news` - News/article sharing
- `comparison` - Comparing two EVs

### User States
- `uncertain` - Expresses doubt (tool intro allowed)
- `confident` - Already decided
- `frustrated` - Needs extra validation
- `excited` - Positive about EVs
- `skeptical` - Doubts about EVs

### Ownership Phases
- `buyer` - Pre-purchase
- `0_3` - First 3 months
- `4_12` - Months 4-12
- `12_plus` - Over a year

### Friction Tags
- `NO_HOME_CHARGING` - No home charging access
- `HOME_CHARGING_AVAILABLE` - Has home charging
- `PUBLIC_ANCHOR_PRESENT` - Has reliable public anchor
- `PREDICTABILITY_LOW` - Unreliable charging
- `PREDICTABILITY_HIGH` - Reliable charging setup
- `SEASONAL_SENSITIVITY` - Winter concerns
- `PLANNING_TOLERANCE_LOW` - Hates planning
- `PLANNING_TOLERANCE_HIGH` - Comfortable planning
- `ROUTINE_VARIABILITY_HIGH` - Variable schedule
- `COMPARING_TWO_OPTIONS` - Comparing vehicles
- `BATTERY_HEALTH_ANXIETY` - Battery concerns
- `SOFTWARE_TOLERANCE_UNKNOWN` - Software concerns
- `BRAND_WAR_RISK` - Potential brand war

## Tool Introduction Rules

| User State | Tool Mentioned? |
|------------|-----------------|
| Uncertain + uncertainty language | Yes (offer_by_permission) |
| Asks for checklist/tool/link | Yes (asked_directly) |
| Confident | No |
| Frustrated | No (unless asks) |
| Any other state | No |

**Never override this.** If `tool_intro` is `no`, do not add tool mention manually.

## OFFO Reply Style

1. **Validate** - Acknowledge their concern is reasonable
2. **Hidden Tradeoff** - Name what most people miss
3. **Reframe** - Shift from specs to routine fit
4. **Reflective Question** - Help them think, don't tell them what to do
5. **Tool Mention** - Only if permitted

## Files

```
tools/reddit-operator/
├── main.py              # FastAPI app
├── models.py            # Request/response models
├── classifier.py        # Intent/state detection
├── friction_tagger.py   # Friction tag extraction
├── reply_generator.py   # Reply templates
├── db.py                # SQLite persistence
├── requirements.txt     # Dependencies
├── README.md            # This file
└── offo_operator.db     # SQLite database (created on first run)
```

## Future Enhancements

- `/save_edit` endpoint for operator learning
- Phase-based suggestions
- UI layer warning for unauthorized tool mentions
- LLM refinement hook (tone only, never tool intro)
